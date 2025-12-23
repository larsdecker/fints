import { SegmentClass } from "./segment";

export class HIDSEProps {
    public segNo: number;
    public taskId?: string;
}

/**
 * HIDSE (Einreichung terminierter SEPA-Einzellastschrift bestätigen)
 */
export class HIDSE extends SegmentClass(HIDSEProps) {
    public type = "HIDSE";

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
