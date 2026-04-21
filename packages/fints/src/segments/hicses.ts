import { SegmentClass } from "./segment";
import { Parse } from "../parse";

export class HICSESProps {
    public segNo: number;
    public maxRequestCount: number;
    public minSignatures: number;
}

/**
 * HICSES (Terminierte SEPA-Einzelüberweisung Parameter)
 * FinTS 3.0 parameter segment for scheduled SEPA credit transfers (HKCSE).
 *
 * Advertised by the bank during synchronisation to indicate that scheduled
 * credit transfers are supported.
 */
export class HICSES extends SegmentClass(HICSESProps) {
    public type = "HICSES";

    protected serialize(): string[][] {
        throw new Error("Not implemented.");
    }

    protected deserialize(input: string[][]) {
        const [[maxRequestCount], [minSignatures]] = input;
        this.maxRequestCount = Parse.num(maxRequestCount);
        this.minSignatures = Parse.num(minSignatures);
    }
}
