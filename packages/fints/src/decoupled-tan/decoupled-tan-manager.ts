import { DecoupledTanState, DecoupledTanStatus, DecoupledTanConfig } from "./types";
import { DecoupledTanError } from "../errors/decoupled-tan-error";
import { Dialog } from "../dialog";
import { HKTAN } from "../segments";
import { Response } from "../response";
import { TanMethod } from "../tan-method";
import { Request } from "../request";

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
    private timeoutHandle?: ReturnType<typeof setTimeout>;

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
        while (this.isActive()) {
            // Check if cancelled first
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

                // FinTS Return Codes (per FinTS 3.0 PINTAN specification):
                // - "0030": "Order received - TAN/Security clearance required"
                //   This code indicates the server accepted the order but needs TAN confirmation.
                //   It's a success code (0xxx range) that triggers TAN requirement.
                //
                // - "3956": "Strong customer authentication necessary"
                //   This warning code (3xxx range) indicates the decoupled TAN process is still
                //   pending user confirmation on their trusted device (e.g., mobile app).
                //   The client must continue polling until this code disappears.
                //
                // - "3076": "Strong customer authentication necessary (PSD2)"
                //   Similar to 3956, indicates SCA is required per PSD2 regulations.
                //   Used to detect initial decoupled TAN requirement.

                // Check for confirmation: 0030 present WITHOUT 3956 means TAN was approved
                // If 3956 is still present, authentication is pending and we must continue polling
                if (returnValues.has("0030") && !returnValues.has("3956")) {
                    return response;
                }

                // Check for still pending: 3956 means user hasn't approved yet
                // Continue polling until user confirms in their banking app
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

        // If we exit the loop and weren't cancelled, something unexpected happened
        if (this.cancelled) {
            throw new DecoupledTanError("Decoupled TAN cancelled by user", this.getStatus());
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

        // Create a proper Request instance instead of using a plain object
        const request = new Request({
            blz,
            name,
            pin,
            systemId,
            dialogId,
            msgNo,
            segments,
            tanMethods,
        });

        // Send the request using the dialog's connection
        const response = await this.dialog.connection.send(request);

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
