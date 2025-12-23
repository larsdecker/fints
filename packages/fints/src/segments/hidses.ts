import { SegmentClass } from "./segment";

export class HIDSESProps {
    public segNo: number;
}

/**
 * HIDSES (Terminierte SEPA-Einzellastschrift einreichen Parameter)
 */
export class HIDSES extends SegmentClass(HIDSESProps) {
    public type = "HIDSES";

    protected serialize(): string[][] {
        throw new Error("Not implemented.");
    }

    protected deserialize(): void {
        return;
    }
}
