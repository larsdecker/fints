import { Connection } from "./types";
import {
    HKIDN,
    HKVVB,
    HKSYN,
    HKTAN,
    HKEND,
    HISALS,
    HIKAZS,
    HICDBS,
    HIUPD,
    HITANS,
    HIWPDS,
    HIDSES,
    HICCSS,
    Segment,
} from "./segments";
import { Request } from "./request";
import { Response } from "./response";
import { TanMethod } from "./tan-method";
import { escapeFinTS } from "./utils";
import { ResponseError } from "./errors/response-error";
import { TanRequiredError, TanProcessStep } from "./errors/tan-required-error";
import { HITAN } from "./segments/hitan";
import { PRODUCT_NAME } from "./constants";
import {
    DecoupledTanManager,
    DecoupledTanStatusCallback,
    DecoupledTanConfig,
    DecoupledTanState,
} from "./decoupled-tan";

/**
 * Properties passed to configure a `Dialog`.
 */
export class DialogConfig {
    /**
     * The product ID that was assigned by ZKA
     */
    public productId = PRODUCT_NAME;
    /**
     * The banks identification number (Bankleitzahl).
     */
    public blz: string;
    /**
     * The username or identification number.
     */
    public name: string;
    /**
     * The pin code or password used for authenticating with the fints server.
     */
    public pin: string;
    /**
     * The system's id. This id needs to be stored across all dialogs and will be assigned
     * by the server at the first request.
     */
    public systemId: string;
}

/**
 * A dialog consisting of multiple related requests and responses.
 */
export class Dialog extends DialogConfig {
    /**
     * All messages sent within a dialog are numbered.
     * This counter is kept here.
     */
    public msgNo = 1;
    /**
     * A unique id for the dialog.
     * Assigned by the server as response to the initial request.
     * For the initial request a `0` needs to be sent.
     */
    public dialogId = "0";
    /**
     * A list of allowed TAN methods as configured by the server.
     */
    public tanMethods: TanMethod[] = [];
    /**
     * The server will only accept a certain version for the HISALS segment.
     * This version defaults to the latest version (6).
     * The server's maximum supported version can be parsed from the initial requests and is stored here.
     */
    public hisalsVersion = 6;
    /**
     * The server will only accept a certain version for the HIKAZS segment.
     * This version defaults to the latest version (6).
     * The server's maximum supported version can be parsed from the initial requests and is stored here.
     */
    public hikazsVersion = 6;
    /**
     * The server will only accept a certain version for the HICDB segment.
     * This version defaults to the latest version (1).
     * The server's maximum supported version can be parsed from the initial requests and is stored here.
     */
    public hicdbVersion = 1;

    public hktanVersion = 1;
    public hkdseVersion = 1;
    public hkccsVersion = 1;
    /**
     * The server will only accept a certain version for the HIWPD segment.
     * Stores the maximum supported version parsed during synchronization.
     */
    public hiwpdsVersion = 0;
    /**
     * A list of supported SEPA pain-formats as configured by the server.
     */
    public painFormats: string[] = [];

    public hiupd: HIUPD[];

    public connection: Connection;

    /**
     * Active decoupled TAN manager if a decoupled TAN process is in progress
     */
    private decoupledTanManager?: DecoupledTanManager;

    /**
     * Configuration for decoupled TAN behavior
     */
    public decoupledTanConfig?: DecoupledTanConfig;

    constructor(config: DialogConfig, connection: Connection, decoupledTanConfig?: DecoupledTanConfig) {
        super();
        Object.assign(this, config);
        this.connection = connection;
        this.decoupledTanConfig = decoupledTanConfig;
    }

    /**
     * Send a synchronization request to the server.
     * Only one synchronization is needed per dialog.
     * This is most likely the initial request sent.
     * It will be answered with the system's id and a list of supported TAN methods.
     * The supported HISALS and HIKAZS version can also be parsed from this request.
     *
     * @return The response as received by the server.
     */
    public async sync() {
        const { blz, name, pin, systemId, dialogId, msgNo } = this;
        const segments = [
            new HKIDN({ segNo: 3, blz, name, systemId: "0" }),
            new HKVVB({ segNo: 4, productId: this.productId, lang: 0 }),
            new HKSYN({ segNo: 5 }),
        ];
        const response = await this.send(new Request({ blz, name, pin, systemId, dialogId, msgNo, segments }));
        this.systemId = escapeFinTS(response.systemId);
        this.dialogId = response.dialogId;
        this.hisalsVersion = response.segmentMaxVersion(HISALS);
        this.hikazsVersion = response.segmentMaxVersion(HIKAZS);
        this.hicdbVersion = response.segmentMaxVersion(HICDBS);
        const hkdseVersion = response.segmentMaxVersion(HIDSES);
        this.hkdseVersion = hkdseVersion > 0 ? hkdseVersion : 1;
        const hkccsVersion = response.segmentMaxVersion(HICCSS);
        this.hkccsVersion = hkccsVersion > 0 ? hkccsVersion : 1;
        this.hiwpdsVersion = response.segmentMaxVersion(HIWPDS);
        this.hktanVersion = response.segmentMaxVersion(HITANS);
        this.tanMethods = response.supportedTanMethods;
        this.painFormats = response.painFormats;
        const hiupd = response.findSegments(HIUPD);
        this.hiupd = hiupd;
        await this.end();
    }

    /**
     * Send the initializing request to the server.
     * The dialog is ready for performing custom requests afterwards.
     */
    public async init(): Promise<Response> {
        const { blz, name, pin, dialogId, msgNo, tanMethods } = this;
        const segments: Segment<any>[] = [
            new HKIDN({ segNo: 3, blz, name, systemId: "0" }),
            new HKVVB({ segNo: 4, productId: this.productId, lang: 0 }),
        ];
        if (this.hktanVersion >= 6) {
            const version = this.hktanVersion >= 7 ? 7 : 6;
            segments.push(new HKTAN({ segNo: 5, version, process: "4" }));
        }
        const response: Response = await this.send(
            new Request({ blz, name, pin, systemId: "0", dialogId, msgNo, segments, tanMethods }),
        );
        this.dialogId = response.dialogId;
        return response;
    }

    /**
     * End the currently open request.
     */
    public async end() {
        const { blz, name, pin, systemId, dialogId, msgNo } = this;
        const segments = [new HKEND({ segNo: 3, dialogId })];
        await this.send(new Request({ blz, name, pin, systemId, dialogId, msgNo, segments }));
        this.dialogId = "0";
        this.msgNo = 1;
    }

    /**
     * Send a custom request to the fints server and return the received response.
     *
     * @param request The request to send to the server.
     *
     * @return The response received from the server.
     */
    public async send(request: Request): Promise<Response> {
        request.msgNo = this.msgNo;
        request.dialogId = this.dialogId;
        request.tanMethods = this.tanMethods;

        const response = await this.connection.send(request);
        this.dialogId = response.dialogId;
        if (!response.success) {
            throw new ResponseError(response);
        }
        if (response.returnValues().has("0030")) {
            const hitan = response.findSegment(HITAN);
            const returnValue = response.returnValues().get("0030");

            // Determine which segment triggered the TAN requirement
            const triggeringSegment = request.segments.length > 0 ? request.segments[0].type : undefined;

            // Check for decoupled TAN indicators per FinTS 3.0 PINTAN specification:
            // - "3956": Indicates strong customer authentication (SCA) is pending on trusted device
            // - "3076": PSD2-mandated strong customer authentication required
            // When either code is present alongside "0030", it signals decoupled TAN flow
            // where the user must approve the transaction in a separate app (e.g., mobile banking)
            const returnValues = response.returnValues();
            const isDecoupled = returnValues.has("3956") || returnValues.has("3076");

            const error = new TanRequiredError(
                returnValue.message,
                hitan.transactionReference,
                hitan.challengeText,
                hitan.challengeMedia,
                this,
                TanProcessStep.CHALLENGE_RESPONSE_NEEDED,
                triggeringSegment,
                {
                    returnCode: "0030",
                    requestSegments: request.segments.map((s) => s.type),
                },
            );

            // Mark as decoupled if detected
            if (isDecoupled) {
                error.decoupledTanState = DecoupledTanState.INITIATED;
            }

            throw error;
        }
        this.msgNo++;
        return response;
    }

    /**
     * Handle a decoupled TAN challenge by starting the polling process
     *
     * Implements the FinTS 3.0 PINTAN decoupled TAN authentication flow (tanProcess="2").
     * This method automatically polls the server for transaction approval until the user
     * confirms the transaction in their trusted device (e.g., mobile banking app).
     *
     * **FinTS Specification:**
     * - Uses HKTAN segment with process="2" for status polling
     * - Monitors return codes: 3956 (pending), 0030 (confirmed)
     * - Respects server timing from HITANS segment parameters
     *
     * **Polling Behavior:**
     * - Waits before first request (default: 2000ms, configurable)
     * - Polls at regular intervals (default: 2000ms, configurable)
     * - Maximum requests (default: 60, configurable)
     * - Total timeout (default: 5 minutes, configurable)
     *
     * @param transactionReference The transaction reference from the TAN challenge (HITAN segment)
     * @param challengeText The challenge text to display to the user
     * @param statusCallback Optional callback for status updates during polling
     * @return The final response after confirmation
     *
     * @throws {DecoupledTanError} If timeout occurs, max requests exceeded, or user cancels
     *
     * @see DecoupledTanManager for detailed polling implementation
     * @see https://www.hbci-zka.de/ for FinTS specification
     */
    public async handleDecoupledTan(
        transactionReference: string,
        challengeText: string,
        statusCallback?: DecoupledTanStatusCallback,
    ): Promise<Response> {
        // Ensure TAN methods are available before attempting decoupled TAN handling
        if (!this.tanMethods || this.tanMethods.length === 0) {
            throw new Error(
                "No TAN methods are available for decoupled TAN handling. " +
                    "Ensure the dialog is properly initialized and TAN methods have been retrieved.",
            );
        }

        // Find the appropriate TAN method (prefer one with decoupled support)
        const tanMethod = this.tanMethods.find((m) => m.decoupledMaxStatusRequests !== undefined) || this.tanMethods[0];

        this.decoupledTanManager = new DecoupledTanManager(
            transactionReference,
            challengeText,
            this,
            this.decoupledTanConfig,
            tanMethod,
        );

        return this.decoupledTanManager.pollForConfirmation(statusCallback);
    }

    /**
     * Check the status of an active decoupled TAN process
     *
     * @return Current status if a process is active, undefined otherwise
     */
    public checkDecoupledTanStatus() {
        return this.decoupledTanManager?.getStatus();
    }

    /**
     * Cancel an active decoupled TAN process
     */
    public cancelDecoupledTan(): void {
        if (this.decoupledTanManager) {
            this.decoupledTanManager.cancel();
            this.decoupledTanManager = undefined;
        }
    }
}
