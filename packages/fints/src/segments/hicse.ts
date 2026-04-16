import { SegmentClass } from "./segment";

export class HICSEProps {
    public segNo: number;
    public taskId?: string;
}

/**
 * HICSE (Terminierte SEPA-Einzelüberweisung bestätigen)
 * FinTS 3.0 response to HKCSE.
 *
 * Contains the task identifier assigned by the bank for the scheduled credit
 * transfer that was just submitted.
 */
export class HICSE extends SegmentClass(HICSEProps) {
    public type = "HICSE";

    protected serialize(): string[][] {
        throw new Error("Not implemented.");
    }

    protected deserialize(input: string[][]) {
        if (input.length === 0) {
            return;
        }
        const [[taskId = ""] = []] = input;
        this.taskId = taskId || undefined;
    }
}
