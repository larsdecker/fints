import { SegmentClass } from "./segment";

export class HICCSSProps {
    public segNo: number;
}

/**
 * HICCSS (SEPA credit transfer parameters)
 */
export class HICCSS extends SegmentClass(HICCSSProps) {
    public type = "HICCSS";

    protected serialize(): string[][] {
        throw new Error("Not implemented.");
    }

    protected deserialize(): void {
        return;
    }
}
