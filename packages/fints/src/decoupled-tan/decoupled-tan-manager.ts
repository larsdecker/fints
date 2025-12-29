import { DecoupledTanState, DecoupledTanStatus, DecoupledTanConfig } from "./types";
import { DecoupledTanError } from "../errors/decoupled-tan-error";
import { Dialog } from "../dialog";
import { HKTAN } from "../segments";
import { Response } from "../response";
import { TanMethod } from "../tan-method";

/**
 * Default configuration for decoupled TAN
 */
const DEFAULT_CONFIG: Required<DecoupledTanConfig> = {
    autoStartPolling: true,
    maxStatusRequests: 60,
    waitBeforeFirstStatusRequest: 2000,
    waitBetweenStatusRequests: 2000,
    totalTimeout: 5 * 60 * 1000, // 5 minutes
};

/**
 * Callback function for status updates during polling
 */
export type DecoupledTanStatusCallback = (status: DecoupledTanStatus) => void | Promise<void>;

/**
 * Manages the lifecycle of a decoupled TAN (asynchronous authentication) process.
 * Handles automatic polling with exponential backoff, state management, and timeout handling.
 */
export class DecoupledTanManager {
    private status: DecoupledTanStatus;
    private config: Required<DecoupledTanConfig>;
    private dialog: Dialog;
    private tanMethod?: TanMethod;
    private cancelled = false;
    private startTime: Date;
    private timeoutHandle?: NodeJS.Timeout;

    constructor(
        transactionReference: string,
        challengeText: string,
        dialog: Dialog,
        config?: DecoupledTanConfig,
        tanMethod?: TanMethod,
    ) {
        this.dialog = dialog;
        this.tanMethod = tanMethod;
        this.startTime = new Date();

        // Merge config with defaults, preferring server-provided values from TanMethod
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
        };

        // Override with server-provided values if available
        if (tanMethod) {
            if (tanMethod.decoupledMaxStatusRequests !== undefined) {
                this.config.maxStatusRequests = tanMethod.decoupledMaxStatusRequests;
            }
            if (tanMethod.decoupledWaitBeforeFirstStatusRequest !== undefined) {
                this.config.waitBeforeFirstStatusRequest = tanMethod.decoupledWaitBeforeFirstStatusRequest;
            }
            if (tanMethod.decoupledWaitBetweenStatusRequests !== undefined) {
                this.config.waitBetweenStatusRequests = tanMethod.decoupledWaitBetweenStatusRequests;
            }
        }

        this.status = {
            state: DecoupledTanState.INITIATED,
            transactionReference,
            challengeText,
            statusRequestCount: 0,
            maxStatusRequests: this.config.maxStatusRequests,
            startTime: this.startTime,
        };
    }

    /**
     * Get the current status
     */
    public getStatus(): DecoupledTanStatus {
        return { ...this.status };
    }

    /**
     * Check if the process is still active
     */
    public isActive(): boolean {
        return (
            this.status.state === DecoupledTanState.INITIATED ||
            this.status.state === DecoupledTanState.CHALLENGE_SENT ||
            this.status.state === DecoupledTanState.PENDING_CONFIRMATION
        );
    }

    /**
     * Cancel the decoupled TAN process
     */
    public cancel(): void {
        this.cancelled = true;
        if (this.timeoutHandle) {
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = undefined;
        }
        this.updateState(DecoupledTanState.CANCELLED);
    }

    /**
     * Start the polling process and wait for confirmation
     */
    public async pollForConfirmation(statusCallback?: DecoupledTanStatusCallback): Promise<Response> {
        // Set state to CHALLENGE_SENT
        this.updateState(DecoupledTanState.CHALLENGE_SENT);
        if (statusCallback) {
            await statusCallback(this.getStatus());
        }

        // Set up total timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
            this.timeoutHandle = setTimeout(() => {
                this.updateState(DecoupledTanState.TIMED_OUT, "Total timeout exceeded");
                reject(
                    new DecoupledTanError(
                        `Decoupled TAN timed out after ${this.config.totalTimeout}ms`,
                        this.getStatus(),
                    ),
                );
            }, this.config.totalTimeout);
        });

        try {
            // Wait before first status request
            await this.wait(this.config.waitBeforeFirstStatusRequest);

            // Start polling
            this.updateState(DecoupledTanState.PENDING_CONFIRMATION);
            if (statusCallback) {
                await statusCallback(this.getStatus());
            }

            const response = await Promise.race([this.pollLoop(statusCallback), timeoutPromise]);

            // Clear timeout
            if (this.timeoutHandle) {
                clearTimeout(this.timeoutHandle);
                this.timeoutHandle = undefined;
            }

            this.updateState(DecoupledTanState.CONFIRMED);
            if (statusCallback) {
                await statusCallback(this.getStatus());
            }

            return response;
        } catch (error) {
            // Clear timeout
            if (this.timeoutHandle) {
                clearTimeout(this.timeoutHandle);
                this.timeoutHandle = undefined;
            }
            throw error;
        }
    }

    /**
     * Main polling loop
     */
    private async pollLoop(statusCallback?: DecoupledTanStatusCallback): Promise<Response> {
        while (this.isActive() && !this.cancelled) {
            // Check if cancelled
            if (this.cancelled) {
                throw new DecoupledTanError("Decoupled TAN cancelled by user", this.getStatus());
            }

            // Check if we've exceeded max status requests
            if (this.status.statusRequestCount >= this.config.maxStatusRequests) {
                this.updateState(DecoupledTanState.FAILED, "Maximum status requests exceeded");
                throw new DecoupledTanError("Maximum status requests exceeded", this.getStatus());
            }

            // Make status request
            try {
                const response = await this.checkStatus();

                // Increment counter
                this.status.statusRequestCount++;

                // Check response for confirmation or error codes
                const returnValues = response.returnValues();

                // Check for confirmation (0030 without 3956)
                if (returnValues.has("0030") && !returnValues.has("3956")) {
                    return response;
                }

                // Check for still pending (3956)
                if (returnValues.has("3956")) {
                    // Still pending, continue polling
                    if (statusCallback) {
                        await statusCallback(this.getStatus());
                    }
                    await this.wait(this.config.waitBetweenStatusRequests);
                    continue;
                }

                // Check for errors
                if (!response.success) {
                    const errorMessages = response.errors.join(", ");
                    this.updateState(DecoupledTanState.FAILED, errorMessages);
                    throw new DecoupledTanError(`Server error: ${errorMessages}`, this.getStatus());
                }

                // Unexpected response, treat as confirmation
                return response;
            } catch (error) {
                if (error instanceof DecoupledTanError) {
                    throw error;
                }
                // Other errors (network, etc.)
                this.updateState(DecoupledTanState.FAILED, String(error));
                throw new DecoupledTanError(`Error during polling: ${error}`, this.getStatus());
            }
        }

        throw new DecoupledTanError("Polling loop exited unexpectedly", this.getStatus());
    }

    /**
     * Make a single status check request
     */
    private async checkStatus(): Promise<Response> {
        const version = this.dialog.hktanVersion >= 7 ? 7 : this.dialog.hktanVersion;
        const segments = [
            new HKTAN({
                segNo: 3,
                version,
                process: "2",
                aref: this.status.transactionReference,
            }),
        ];

        const { blz, name, pin, systemId, dialogId, msgNo, tanMethods } = this.dialog;
        const request = {
            blz,
            name,
            pin,
            systemId,
            dialogId,
            msgNo,
            segments,
            tanMethods,
        };

        // Use the dialog's connection to send the request
        // Note: We bypass dialog.send() to avoid incrementing msgNo unnecessarily
        request.msgNo = this.dialog.msgNo;
        request.dialogId = this.dialog.dialogId;
        const response = await this.dialog.connection.send(request as any);

        return response;
    }

    /**
     * Update the state
     */
    private updateState(state: DecoupledTanState, errorMessage?: string): void {
        this.status.state = state;
        if (errorMessage) {
            this.status.errorMessage = errorMessage;
        }
    }

    /**
     * Wait for a specified duration
     */
    private async wait(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
