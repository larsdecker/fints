/**
 * Decoupled TAN (Asynchronous Authentication) Types
 *
 * Implements types for FinTS 3.0 Security Sicherheitsverfahren PINTAN specification
 * for decoupled TAN authentication, where transaction approval occurs asynchronously
 * on a separate trusted device (e.g., mobile banking app).
 *
 * **FinTS Specification Reference:**
 * - Document: "Sicherheitsverfahren PINTAN" Version 3.0
 * - Section: "Zwei-Schritt-TAN-Verfahren" (Two-Step TAN Procedure)
 * - HKTAN Segment: Section B.5.1 (TAN-Verfahren festlegen)
 * - Process: tanProcess="2" for decoupled/asynchronous authentication
 *
 * @see https://www.hbci-zka.de/ for FinTS specification documentation
 */

/**
 * States of the decoupled TAN lifecycle
 *
 * These states track the progression of a decoupled TAN authentication
 * from initiation through completion or failure.
 */
export enum DecoupledTanState {
    /** Challenge has been received from the server */
    INITIATED = "initiated",
    /** Challenge text has been presented to the user */
    CHALLENGE_SENT = "challenge_sent",
    /** Polling for confirmation from the user's device */
    PENDING_CONFIRMATION = "pending_confirmation",
    /** Confirmation received from server */
    CONFIRMED = "confirmed",
    /** Error occurred during the TAN process */
    FAILED = "failed",
    /** User cancelled the TAN process */
    CANCELLED = "cancelled",
    /** Total timeout exceeded */
    TIMED_OUT = "timed_out",
}

/**
 * Configuration for decoupled TAN polling behavior
 */
export interface DecoupledTanConfig {
    /**
     * Automatically start polling when a decoupled TAN challenge is detected
     * @default true
     */
    autoStartPolling?: boolean;

    /**
     * Maximum number of status requests to make
     * Can be overridden by server-provided value from TAN method
     * @default 60
     */
    maxStatusRequests?: number;

    /**
     * Time to wait (in milliseconds) before the first status request
     * Can be overridden by server-provided value from TAN method
     * @default 2000
     */
    waitBeforeFirstStatusRequest?: number;

    /**
     * Time to wait (in milliseconds) between subsequent status requests
     * Can be overridden by server-provided value from TAN method
     * @default 2000
     */
    waitBetweenStatusRequests?: number;

    /**
     * Total timeout (in milliseconds) for the entire decoupled TAN process
     * @default 300000 (5 minutes)
     */
    totalTimeout?: number;
}

/**
 * Status information for an active decoupled TAN process
 */
export interface DecoupledTanStatus {
    /** Current state of the decoupled TAN process */
    state: DecoupledTanState;

    /** Transaction reference from the server */
    transactionReference: string;

    /** Challenge text presented to the user */
    challengeText?: string;

    /** Number of status requests made so far */
    statusRequestCount: number;

    /** Maximum number of status requests allowed */
    maxStatusRequests: number;

    /** Timestamp when the process started */
    startTime: Date;

    /** Error message if state is FAILED */
    errorMessage?: string;

    /** Server return code if available */
    returnCode?: string;
}
