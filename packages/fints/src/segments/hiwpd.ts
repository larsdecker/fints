import { SegmentClass } from "./segment";

export class HIWPDProps {
    public segNo: number;
    public holdings: string;
}

/**
 * HIWPD (Depotaufstellung rückmelden)
 * Section D.6.1
 */
export class HIWPD extends SegmentClass(HIWPDProps) {
    public type = "HIWPD";

    protected serialize(): string[][] { throw new Error("Not implemented."); }

    protected deserialize(input: string[][]) {
        const group = input[0] || [];
        this.holdings = group[0] || "";
    }
}
