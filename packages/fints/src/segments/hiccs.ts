import { SegmentClass } from "./segment";

export class HICCSProps {
    public segNo: number;
    public taskId?: string;
}

/**
 * HICCS (SEPA credit transfer acknowledgement)
 */
export class HICCS extends SegmentClass(HICCSProps) {
    public type = "HICCS";

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
