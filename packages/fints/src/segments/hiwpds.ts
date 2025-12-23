import { SegmentClass } from "./segment";
import { Parse } from "../parse";

export class HIWPDSProps {
    public segNo: number;
    public maxRequestCount?: number;
    public minSignatures?: number;
}

/**
 * HIWPDS (Depotaufstellung Parameter)
 * Section D.6.1
 */
export class HIWPDS extends SegmentClass(HIWPDSProps) {
    public type = "HIWPDS";

    protected serialize(): string[][] {
        throw new Error("Not implemented.");
    }

    protected deserialize(input: string[][]) {
        const [maxRequestsGroup = [], minSignaturesGroup = []] = input;
        if (maxRequestsGroup[0]) {
            this.maxRequestCount = Parse.num(maxRequestsGroup[0]);
        }
        if (minSignaturesGroup[0]) {
            this.minSignatures = Parse.num(minSignaturesGroup[0]);
        }
    }
}
