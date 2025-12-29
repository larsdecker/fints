import { Dialog } from "../dialog";
import { DirectDebitSubmission, CreditTransferSubmission } from "../types";
import { DecoupledTanState } from "../decoupled-tan/types";

/**
 * TAN process steps for multi-step flows
 */
export enum TanProcessStep {
    INITIAL = "initial",
    CHALLENGE_SENT = "challenge_sent",
    CHALLENGE_RESPONSE_NEEDED = "challenge_response_needed",
    COMPLETED = "completed",
}

export class TanRequiredError extends Error {
    public transactionReference: string;
    public challengeText: string;
    public challengeMedia: Buffer;
    public dialog: Dialog;
    public directDebitSubmission?: DirectDebitSubmission;
    public creditTransferSubmission?: CreditTransferSubmission;
    /**
     * Current step in the TAN process flow
     */
    public processStep: TanProcessStep;
    /**
     * Segment that triggered the TAN requirement
     */
    public triggeringSegment?: string;
    /**
     * Additional context information for debugging
     */
    public context?: Record<string, any>;
    /**
     * Decoupled TAN state if this is a decoupled TAN challenge
     */
    public decoupledTanState?: DecoupledTanState;

    constructor(
        message: string,
        transactionReference: string,
        challengeText: string,
        challengeMedia: Buffer,
        dialog: Dialog,
        processStep: TanProcessStep = TanProcessStep.CHALLENGE_RESPONSE_NEEDED,
        triggeringSegment?: string,
        context?: Record<string, any>,
    ) {
        super(message);
        this.transactionReference = transactionReference;
        this.challengeText = challengeText;
        this.challengeMedia = challengeMedia;
        this.dialog = dialog;
        this.processStep = processStep;
        this.triggeringSegment = triggeringSegment;
        this.context = context;

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, TanRequiredError);
        }
    }

    /**
     * Helper to check if this is a multi-step TAN flow
     */
    public isMultiStep(): boolean {
        return this.processStep !== TanProcessStep.COMPLETED;
    }

    /**
     * Check if this is a decoupled TAN challenge
     */
    public isDecoupledTan(): boolean {
        return this.decoupledTanState !== undefined;
    }

    /**
     * Get a user-friendly description of the current step
     */
    public getStepDescription(): string {
        switch (this.processStep) {
            case TanProcessStep.INITIAL:
                return "TAN process initiated";
            case TanProcessStep.CHALLENGE_SENT:
                return "TAN challenge has been sent";
            case TanProcessStep.CHALLENGE_RESPONSE_NEEDED:
                return "TAN response required";
            case TanProcessStep.COMPLETED:
                return "TAN process completed";
            default:
                return "Unknown TAN process step";
        }
    }
}
