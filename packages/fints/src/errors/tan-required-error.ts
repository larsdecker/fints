import { Dialog } from "../dialog";

export class TanRequiredError extends Error {
    public transactionReference: string;
    public challengeText: string;
    public challengeMedia: Buffer;
    public dialog: Dialog;
    public context?: Record<string, any>;

    constructor(
        message: string,
        transactionReference: string,
        challengeText: string,
        challengeMedia: Buffer,
        dialog: Dialog,
        context?: Record<string, any>,
    ) {
        super(message);
        this.transactionReference = transactionReference;
        this.challengeText = challengeText;
        this.challengeMedia = challengeMedia;
        this.dialog = dialog;
        this.context = context;
    }
}
