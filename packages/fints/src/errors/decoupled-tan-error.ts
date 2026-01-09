import { DecoupledTanState, DecoupledTanStatus } from "../decoupled-tan/types";

/**
 * Error thrown when a decoupled TAN process fails
 *
 * This error captures the complete state of a decoupled TAN authentication attempt
 * at the time of failure, providing detailed information for error handling and debugging.
 *
 * **Common Failure Scenarios:**
 * - TIMED_OUT: Total timeout exceeded before user confirmation
 * - CANCELLED: User explicitly cancelled the TAN process
 * - FAILED: Server error or maximum status requests exceeded
 *
 * **FinTS Context:**
 * - Decoupled TAN implements tanProcess="2" from FinTS 3.0 PINTAN specification
 * - Failures typically occur during polling phase (return code 3956 monitoring)
 * - Transaction reference allows correlation with server-side state
 *
 * @see DecoupledTanManager for the polling implementation
 * @see https://www.hbci-zka.de/ for FinTS specification
 */
export class DecoupledTanError extends Error {
    /** Current state when the error occurred */
    public readonly state: DecoupledTanState;

    /** Transaction reference from the server */
    public readonly transactionReference: string;

    /** Number of status requests remaining when error occurred */
    public readonly remainingStatusRequests: number;

    /** The full status at the time of error */
    public readonly status: DecoupledTanStatus;

    /** Server return code if available */
    public readonly returnCode?: string;

    constructor(message: string, status: DecoupledTanStatus, returnCode?: string) {
        super(message);
        this.name = "DecoupledTanError";
        this.state = status.state;
        this.transactionReference = status.transactionReference;
        this.remainingStatusRequests = status.maxStatusRequests - status.statusRequestCount;
        this.status = status;
        this.returnCode = returnCode;

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DecoupledTanError);
        }
    }

    /**
     * Get a user-friendly error message based on the state
     */
    public getUserMessage(): string {
        switch (this.state) {
            case DecoupledTanState.TIMED_OUT:
                return `Decoupled TAN timed out. Please try again. Transaction reference: ${this.transactionReference}`;
            case DecoupledTanState.CANCELLED:
                return `Decoupled TAN was cancelled. Transaction reference: ${this.transactionReference}`;
            case DecoupledTanState.FAILED:
                return `Decoupled TAN failed: ${this.message}. Transaction reference: ${this.transactionReference}`;
            default:
                return `Decoupled TAN error in state ${this.state}: ${this.message}`;
        }
    }

    /**
     * Check if the error was due to timeout
     */
    public isTimeout(): boolean {
        return this.state === DecoupledTanState.TIMED_OUT;
    }

    /**
     * Check if the error was due to user cancellation
     */
    public isCancelled(): boolean {
        return this.state === DecoupledTanState.CANCELLED;
    }

    /**
     * Check if more status requests could have been made
     */
    public hasRemainingRequests(): boolean {
        return this.remainingStatusRequests > 0;
    }
}
