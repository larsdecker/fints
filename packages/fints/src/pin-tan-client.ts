import { Client } from "./client";
import { Dialog, DialogConfig } from "./dialog";
import { Request } from "./request";
import { HttpConnection, ConnectionConfig } from "./http-connection";
import { Segment } from "./segments";
import { Connection } from "./types";
import { PRODUCT_NAME } from "./constants";
import { DecoupledTanConfig, DecoupledTanStatusCallback } from "./decoupled-tan";
import { TanRequiredError } from "./errors/tan-required-error";
import { Response } from "./response";

/**
 * Set of options needed to construct a `PinTanClient`.
 */
export interface PinTanClientConfig extends Partial<ConnectionConfig> {
    /**
     * The fints product identification.
     */
    productId?: string;
    /**
     * The banks identification number (Bankleitzahl).
     */
    blz: string;
    /**
     * The username or identification number.
     */
    name: string;
    /**
     * The pin code or password used for authenticating with the fints server.
     */
    pin: string;
    /**
     * The URL to reach the server at.
     */
    url: string;
    /**
     * If set to `true`, will log all requests performed and responses received.
     */
    debug?: boolean;
    /**
     * Configuration for decoupled TAN (asynchronous authentication)
     */
    decoupledTanConfig?: DecoupledTanConfig;
}

export class PinTanClient extends Client {
    /**
     * Connection used to reach the server.
     */
    private connection: Connection;
    /**
     * Configuration for connecting and authenticating.
     */
    protected config: PinTanClientConfig;

    constructor(config: PinTanClientConfig) {
        super();
        this.config = config;
        const { url, debug, timeout, maxRetries, retryDelay } = config;
        const connectionConfig: ConnectionConfig = {
            url,
            debug: debug ?? false,
            timeout: timeout ?? 30000,
            maxRetries: maxRetries ?? 3,
            retryDelay: retryDelay ?? 1000,
        };
        this.connection = new HttpConnection(connectionConfig);
    }

    public createDialog(dialogConfig?: DialogConfig) {
        const { blz, name, pin, productId = PRODUCT_NAME, decoupledTanConfig } = this.config;
        const { connection } = this;
        return new Dialog(
            dialogConfig ? dialogConfig : { blz, name, pin, systemId: "0", productId },
            connection,
            decoupledTanConfig,
        );
    }

    public createRequest(dialog: Dialog, segments: Segment<any>[], tan?: string) {
        const { blz, name, pin } = this.config;
        const { systemId, dialogId, msgNo, tanMethods } = dialog;
        return new Request({ blz, name, pin, systemId, dialogId, msgNo, segments, tanMethods, tan });
    }

    /**
     * Handle a decoupled TAN challenge with automatic polling
     *
     * High-level method for handling decoupled TAN authentication flow.
     * Automatically manages the polling lifecycle and provides status updates
     * through an optional callback.
     *
     * **Usage Pattern:**
     * ```typescript
     * try {
     *   await client.creditTransfer(account, transfer);
     * } catch (error) {
     *   if (error instanceof TanRequiredError && error.isDecoupledTan()) {
     *     await client.handleDecoupledTanChallenge(error, (status) => {
     *       console.log(`State: ${status.state}, Requests: ${status.statusRequestCount}`);
     *     });
     *   }
     * }
     * ```
     *
     * **FinTS Specification:**
     * - Implements tanProcess="2" polling per FinTS 3.0 PINTAN
     * - Uses HKTAN segment for status checks
     * - Respects server timing from HITANS segment
     *
     * @param error The TanRequiredError that contains the challenge information
     * @param statusCallback Optional callback for status updates during polling
     * @return The final response after confirmation
     *
     * @throws {Error} If the error is not a decoupled TAN challenge
     * @throws {DecoupledTanError} If polling fails (timeout, cancellation, etc.)
     *
     * @see Dialog.handleDecoupledTan for lower-level control
     * @see https://www.hbci-zka.de/ for FinTS specification
     */
    public async handleDecoupledTanChallenge(
        error: TanRequiredError,
        statusCallback?: DecoupledTanStatusCallback,
    ): Promise<Response> {
        if (!error.isDecoupledTan()) {
            throw new Error(
                "The provided TanRequiredError does not represent a decoupled TAN challenge. " +
                "Only call handleDecoupledTanChallenge when error.isDecoupledTan() returns true. " +
                "For regular TAN challenges, use your normal TAN handling flow instead."
            );
        }

        return error.dialog.handleDecoupledTan(error.transactionReference, error.challengeText, statusCallback);
    }
}
