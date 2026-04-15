/**
 * FinTS 4.1 Dialog implementation.
 *
 * Manages the dialog lifecycle for FinTS 4.1 XML-based communication.
 */
import { FinTS4DialogConfig, FinTS4Connection, FinTS4Response, BankParameterData } from "./types";
import { buildMessage, XmlSegment } from "./xml-builder";
import { parseResponse } from "./xml-parser";
import { TanMethod } from "../tan-method";
import { SEPAAccount, BankCapabilities } from "../types";
import { PRODUCT_NAME } from "../constants";
import {
    buildDialogInitSegment,
    buildDialogEndSegment,
    buildSyncSegment,
    buildAccountListSegment,
    buildTanSegment,
} from "./segments";
import { verbose } from "../logger";

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
    /** The version for TAN segment. */
    public tanVersion = 1;
    /** Security function to use. */
    public securityFunction = "999";
    /** Minimum signatures required for statements. */
    public statementsMinSignatures = 0;
    /** Minimum signatures required for balance. */
    public balanceMinSignatures = 0;

    /** The connection to the server. */
    private connection: FinTS4Connection;

    constructor(config: FinTS4DialogConfig, connection: FinTS4Connection) {
        this.blz = config.blz;
        this.name = config.name;
        this.pin = config.pin;
        this.systemId = config.systemId || "0";
        this.productId = config.productId || PRODUCT_NAME;
        this.connection = connection;
    }

    /**
     * Send an XML request to the server and parse the response.
     */
    public async send(segments: XmlSegment[], options?: { pin?: string; tan?: string }): Promise<FinTS4Response> {
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
        });

        verbose(`FinTS 4.1 sending message #${this.msgNo} to dialog ${this.dialogId}`);
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
            throw new Error(`FinTS 4.1 request failed: ${errors}`);
        }

        this.msgNo++;
        return response;
    }

    /**
     * Perform synchronization to obtain system ID, BPD, UPD, and TAN methods.
     */
    public async sync(): Promise<FinTS4Response> {
        const segments: XmlSegment[] = [
            buildDialogInitSegment({
                segNo: 1,
                blz: this.blz,
                name: this.name,
                systemId: "0",
                productId: this.productId,
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
                this.securityFunction = this.tanMethods[0].securityFunction;
            }
        }

        // Update segment versions
        if (response.segmentVersions) {
            this.segmentVersions = response.segmentVersions;
        }

        // Determine capabilities
        this.updateCapabilities();

        // Update supported formats
        if (response.supportedCamtFormats) {
            this.supportedCamtFormats = response.supportedCamtFormats;
        }
        if (response.painFormats) {
            this.painFormats = response.painFormats;
        }

        // End the sync dialog
        await this.end();

        return response;
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
            await this.send(
                [buildDialogEndSegment({ segNo: 1, dialogId: this.dialogId })],
                { pin: this.pin },
            );
        } finally {
            this.dialogId = "0";
            this.msgNo = 1;
        }
    }

    /**
     * Update capability flags based on segment versions received during sync.
     */
    private updateCapabilities(): void {
        const balVer = this.segmentVersions.get("Balance") || this.segmentVersions.get("HISALS") || 0;
        this.supportsBalance = balVer > 0;
        if (balVer > 0) this.balanceVersion = balVer;

        const stmtVer = this.segmentVersions.get("AccountStatement") || this.segmentVersions.get("HIKAZS") || this.segmentVersions.get("HICAZS") || 0;
        this.supportsStatements = stmtVer > 0;
        if (stmtVer > 0) this.statementVersion = stmtVer;

        const tanVer = this.segmentVersions.get("TAN") || this.segmentVersions.get("HITANS") || 0;
        if (tanVer > 0) this.tanVersion = tanVer;
    }

    /**
     * Get the bank capabilities based on the synchronization data.
     */
    public get capabilities(): BankCapabilities {
        return {
            supportsAccounts: true,
            supportsBalance: this.supportsBalance,
            supportsTransactions: this.supportsStatements,
            supportsHoldings: false, // Not yet implemented in v4.1
            supportsStandingOrders: false, // Not yet implemented in v4.1
            supportsCreditTransfer: false, // Read-only for now
            supportsDirectDebit: false, // Read-only for now
            requiresTanForTransactions: this.statementsMinSignatures > 0,
            requiresTanForBalance: this.balanceMinSignatures > 0,
        };
    }
}
