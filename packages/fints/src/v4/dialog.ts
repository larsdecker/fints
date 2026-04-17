/**
 * FinTS 4.1 Dialog implementation.
 *
 * Manages the dialog lifecycle for FinTS 4.1 XML-based communication.
 */
import { FinTS4DialogConfig, FinTS4Connection, FinTS4Response, BankParameterData, TanCallback } from "./types";
import { buildMessage, XmlSegment } from "./xml-builder";
import { parseResponse } from "./xml-parser";
import { TanMethod } from "../tan-method";
import { BankCapabilities, SEPAAccount } from "../types";
import { PRODUCT_NAME } from "../constants";
import { FINTS_VERSION } from "./constants";
import {
    buildDialogInitSegment,
    buildDialogEndSegment,
    buildSyncSegment,
    buildTanSegment,
    buildTanSubmitSegment,
} from "./segments";
import { verbose } from "../logger";

/** FinTS return code: version not supported. */
const RETURN_CODE_VERSION_NOT_SUPPORTED = "9010";

/** HBCI versions to try when version negotiation fails, in descending preference order. */
const FALLBACK_HBCI_VERSIONS = ["4.1", "4.0", "3.0"];

/**
 * Error thrown when the server requires a TAN but no `tanCallback` was configured.
 *
 * Unlike the FinTS 3.0 `TanRequiredError`, this version is simpler: it surfaces
 * only the data needed for the v4 two-step TAN flow.
 */
export class FinTS4TanRequiredError extends Error {
    /** The TAN challenge details from the server. */
    public readonly transactionReference: string;
    /** The challenge text to display to the user. */
    public readonly challengeText?: string;

    constructor(transactionReference: string, challengeText?: string) {
        super(
            `FinTS 4.1: Server requires a TAN (ref: ${transactionReference}). ` +
                `Configure a 'tanCallback' to handle interactive TAN challenges.`,
        );
        this.transactionReference = transactionReference;
        this.challengeText = challengeText;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, FinTS4TanRequiredError);
        }
    }
}

/**
 * A dialog representing a session with a FinTS 4.1 server.
 */
export class FinTS4Dialog {
    /** The bank's identification number. */
    public blz: string;
    /** The username or customer ID. */
    public name: string;
    /** The PIN. */
    public pin: string;
    /** System ID assigned by the server. */
    public systemId: string;
    /** Product registration ID. */
    public productId: string;
    /** Current message number within the dialog. */
    public msgNo = 1;
    /** Dialog ID assigned by the server. */
    public dialogId = "0";
    /** TAN methods supported by the server. */
    public tanMethods: TanMethod[] = [];
    /** Bank Parameter Data from synchronization. */
    public bpd?: BankParameterData;
    /** Supported segment versions (segment type -> max version). */
    public segmentVersions = new Map<string, number>();
    /** Whether the bank supports balance queries. */
    public supportsBalance = false;
    /** Whether the bank supports account statements. */
    public supportsStatements = false;
    /** Whether the bank supports holdings/depot queries. */
    public supportsHoldings = false;
    /** Whether the bank supports account listing. */
    public supportsAccounts = true;
    /** Supported camt formats. */
    public supportedCamtFormats: string[] = [];
    /** Supported pain formats. */
    public painFormats: string[] = [];
    /** The version for balance segment. */
    public balanceVersion = 1;
    /** The version for account statement segment. */
    public statementVersion = 1;
    /** The version for holdings segment. */
    public holdingsVersion = 1;
    /** The version for TAN segment. */
    public tanVersion = 1;
    /** Security function to use. */
    public securityFunction = "999";
    /** Minimum signatures required for statements. */
    public statementsMinSignatures = 0;
    /** Minimum signatures required for balance. */
    public balanceMinSignatures = 0;
    /**
     * The HBCI protocol version string used in outgoing messages.
     * Updated during version negotiation when the bank rejects the preferred version.
     */
    public hbciVersion: string = FINTS_VERSION;
    /** Optional callback for interactive TAN challenges. */
    public tanCallback?: TanCallback;

    /** The connection to the server. */
    private connection: FinTS4Connection;

    constructor(config: FinTS4DialogConfig, connection: FinTS4Connection) {
        this.blz = config.blz;
        this.name = config.name;
        this.pin = config.pin;
        this.systemId = config.systemId || "0";
        this.productId = config.productId || PRODUCT_NAME;
        this.connection = connection;
        this.tanCallback = config.tanCallback;
    }

    /**
     * Send an XML request to the server and parse the response.
     *
     * When the server responds with a TAN challenge (return code `0030`) and a
     * `tanCallback` is configured, the challenge is automatically resolved:
     * the callback is invoked, and the TAN is submitted in a follow-up message.
     * If no `tanCallback` is configured, a `FinTS4TanRequiredError` is thrown.
     */
    public async send(
        segments: XmlSegment[],
        options?: { pin?: string; tan?: string; account?: SEPAAccount },
    ): Promise<FinTS4Response> {
        const xmlRequest = buildMessage({
            msgNo: this.msgNo,
            dialogId: this.dialogId,
            segments,
            blz: this.blz,
            name: this.name,
            pin: options?.pin ?? this.pin,
            systemId: this.systemId,
            productId: this.productId,
            tan: options?.tan,
            securityFunction: this.securityFunction,
            hbciVersion: this.hbciVersion,
        });

        verbose(`FinTS 4.1 sending message #${this.msgNo} to dialog ${this.dialogId}`);
        const responseXml = await this.connection.send(xmlRequest);
        const response = parseResponse(responseXml, options?.account);

        if (response.dialogId && response.dialogId !== "0") {
            this.dialogId = response.dialogId;
        }

        if (!response.success) {
            const errors = response.returnValues
                .filter((rv) => rv.isError)
                .map((rv) => `${rv.code}: ${rv.message}`)
                .join("; ");
            throw new Error(`FinTS 4.1 request failed: ${errors}`);
        }

        this.msgNo++;

        // Handle interactive TAN challenge
        if (response.tanRequired && response.tanChallenge) {
            return this.handleTanChallenge(response);
        }

        return response;
    }

    /**
     * Handle a TAN challenge from the server.
     *
     * Invokes `tanCallback` if configured and submits the TAN, then returns
     * the server's final response. Throws `FinTS4TanRequiredError` if no callback
     * is configured.
     */
    private async handleTanChallenge(challengeResponse: FinTS4Response): Promise<FinTS4Response> {
        const challenge = challengeResponse.tanChallenge!;

        if (!this.tanCallback) {
            throw new FinTS4TanRequiredError(challenge.transactionReference, challenge.challengeText);
        }

        verbose(
            `FinTS 4.1: TAN challenge received (ref: ${challenge.transactionReference}). ` + `Invoking tanCallback.`,
        );

        const tan = await this.tanCallback(challenge);

        // Submit the TAN in a new message within the same dialog
        const tanSegments: XmlSegment[] = [
            buildTanSubmitSegment({
                segNo: 1,
                version: this.tanVersion,
                transactionReference: challenge.transactionReference,
            }),
        ];

        const xmlRequest = buildMessage({
            msgNo: this.msgNo,
            dialogId: this.dialogId,
            segments: tanSegments,
            blz: this.blz,
            name: this.name,
            pin: this.pin,
            systemId: this.systemId,
            productId: this.productId,
            tan,
            securityFunction: this.securityFunction,
            hbciVersion: this.hbciVersion,
        });

        verbose(`FinTS 4.1 submitting TAN for reference ${challenge.transactionReference}`);
        const responseXml = await this.connection.send(xmlRequest);
        const response = parseResponse(responseXml);

        if (response.dialogId && response.dialogId !== "0") {
            this.dialogId = response.dialogId;
        }

        if (!response.success) {
            const errors = response.returnValues
                .filter((rv) => rv.isError)
                .map((rv) => `${rv.code}: ${rv.message}`)
                .join("; ");
            throw new Error(`FinTS 4.1 TAN submission failed: ${errors}`);
        }

        this.msgNo++;
        return response;
    }

    /**
     * Perform synchronization to obtain system ID, BPD, UPD, and TAN methods.
     *
     * If the server rejects the HBCI version with error `9010`, the dialog
     * automatically retries with the next version in the fallback list.
     */
    public async sync(): Promise<FinTS4Response> {
        const versionsToTry = this.buildVersionCandidates();

        for (let i = 0; i < versionsToTry.length; i++) {
            const version = versionsToTry[i];
            this.hbciVersion = version;

            try {
                return await this.doSync();
            } catch (err) {
                const msg = (err as Error).message || "";
                const isVersionError = msg.includes(RETURN_CODE_VERSION_NOT_SUPPORTED);

                if (isVersionError && i < versionsToTry.length - 1) {
                    verbose(`FinTS 4.1: Server rejected version ${version}, retrying with next version.`);
                    // Reset dialog state before retry
                    this.dialogId = "0";
                    this.msgNo = 1;
                    continue;
                }
                throw err;
            }
        }

        // Should never reach here
        throw new Error("FinTS 4.1: Exhausted all HBCI version candidates without success.");
    }

    /**
     * Build the list of HBCI versions to try, starting from the current `hbciVersion`.
     */
    private buildVersionCandidates(): string[] {
        const startIdx = FALLBACK_HBCI_VERSIONS.indexOf(this.hbciVersion);
        if (startIdx === -1) {
            return [this.hbciVersion, ...FALLBACK_HBCI_VERSIONS];
        }
        return FALLBACK_HBCI_VERSIONS.slice(startIdx);
    }

    /**
     * Internal sync implementation (one attempt, one version).
     */
    private async doSync(): Promise<FinTS4Response> {
        const segments: XmlSegment[] = [
            buildDialogInitSegment({
                segNo: 1,
                blz: this.blz,
                name: this.name,
                systemId: "0",
                productId: this.productId,
                hbciVersion: this.hbciVersion,
            }),
            buildSyncSegment({ segNo: 2, mode: 0 }),
        ];

        const response = await this.send(segments, { pin: this.pin });

        // Update system ID
        if (response.systemId) {
            this.systemId = response.systemId;
        }

        // Update BPD
        if (response.bpd) {
            this.bpd = response.bpd;
        }

        // Update TAN methods
        if (response.tanMethods && response.tanMethods.length > 0) {
            this.tanMethods = response.tanMethods;
            // Update security function
            // Use the first TAN method's security function if 999 is not available
            const hasDefaultMethod = this.tanMethods.some((m) => m.securityFunction === "999");
            if (!hasDefaultMethod && this.tanMethods.length > 0) {
                this.securityFunction = this.tanMethods[0].securityFunction!;
            }
        }

        // Update segment versions
        if (response.segmentVersions) {
            this.segmentVersions = response.segmentVersions;
        }

        // Determine capabilities and min-signature requirements
        this.updateCapabilities();

        // Update supported formats
        if (response.supportedCamtFormats) {
            this.supportedCamtFormats = response.supportedCamtFormats;
        }
        if (response.painFormats) {
            this.painFormats = response.painFormats;
        }

        // Negotiate HBCI version from bank's supported-versions list
        if (response.supportedHbciVersions && response.supportedHbciVersions.length > 0) {
            const negotiated = this.negotiateVersion(response.supportedHbciVersions);
            if (negotiated) {
                this.hbciVersion = negotiated;
                if (this.bpd) {
                    this.bpd.negotiatedVersion = negotiated;
                }
                verbose(`FinTS 4.1: Negotiated HBCI version ${negotiated}`);
            }
        }

        // End the sync dialog
        await this.end();

        return response;
    }

    /**
     * Select the highest mutually supported HBCI version.
     * Returns undefined if no match is found.
     */
    private negotiateVersion(serverVersions: string[]): string | undefined {
        for (const candidate of FALLBACK_HBCI_VERSIONS) {
            if (serverVersions.includes(candidate)) {
                return candidate;
            }
        }
        return undefined;
    }

    /**
     * Initialize a new dialog for performing business transactions.
     */
    public async init(): Promise<FinTS4Response> {
        const segments: XmlSegment[] = [
            buildDialogInitSegment({
                segNo: 1,
                blz: this.blz,
                name: this.name,
                systemId: this.systemId,
                productId: this.productId,
                hbciVersion: this.hbciVersion,
            }),
        ];

        // Add TAN segment if supported
        if (this.tanVersion >= 1 && this.tanMethods.length > 0) {
            segments.push(
                buildTanSegment({
                    segNo: 2,
                    version: this.tanVersion,
                    process: "4",
                }),
            );
        }

        const response = await this.send(segments, { pin: this.pin });
        return response;
    }

    /**
     * End the current dialog.
     */
    public async end(): Promise<void> {
        try {
            await this.send([buildDialogEndSegment({ segNo: 1, dialogId: this.dialogId })], { pin: this.pin });
        } finally {
            this.dialogId = "0";
            this.msgNo = 1;
        }
    }

    /**
     * Update capability flags based on segment versions received during sync.
     * Also updates min-signature requirements from BPD params.
     */
    private updateCapabilities(): void {
        const balVer = this.segmentVersions.get("Balance") || this.segmentVersions.get("HISALS") || 0;
        this.supportsBalance = balVer > 0;
        if (balVer > 0) this.balanceVersion = balVer;

        const stmtVer =
            this.segmentVersions.get("AccountStatement") ||
            this.segmentVersions.get("HIKAZS") ||
            this.segmentVersions.get("HICAZS") ||
            0;
        this.supportsStatements = stmtVer > 0;
        if (stmtVer > 0) this.statementVersion = stmtVer;

        const holdingsVer =
            this.segmentVersions.get("Holdings") || this.segmentVersions.get("HIWPDS") || 0;
        this.supportsHoldings = holdingsVer > 0;
        if (holdingsVer > 0) this.holdingsVersion = holdingsVer;

        const tanVer = this.segmentVersions.get("TAN") || this.segmentVersions.get("HITANS") || 0;
        if (tanVer > 0) this.tanVersion = tanVer;

        // Update min-signature requirements from BPD
        if (this.bpd?.minSignaturesBalance != null) {
            this.balanceMinSignatures = this.bpd.minSignaturesBalance;
        }
        if (this.bpd?.minSignaturesStatement != null) {
            this.statementsMinSignatures = this.bpd.minSignaturesStatement;
        }
    }

    /**
     * Get the bank capabilities based on the synchronization data.
     */
    public get capabilities(): BankCapabilities {
        return {
            supportsAccounts: true,
            supportsBalance: this.supportsBalance,
            supportsTransactions: this.supportsStatements,
            supportsHoldings: this.supportsHoldings,
            supportsStandingOrders: false, // Not yet implemented in v4.1
            supportsCreditTransfer: false, // Read-only for now
            supportsDirectDebit: false, // Read-only for now
            requiresTanForTransactions: this.statementsMinSignatures > 0,
            requiresTanForBalance: this.balanceMinSignatures > 0,
        };
    }
}
