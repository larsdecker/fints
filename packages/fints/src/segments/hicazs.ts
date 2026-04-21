import { SegmentClass } from "./segment";

export class HICAZSProps {
    public segNo: number;
    public maxDays: number;
    public camtFormat: string;
}

/**
 * HICAZS (CAMT account statement parameters)
 */
export class HICAZS extends SegmentClass(HICAZSProps) {
    public type = "HICAZS";

    protected serialize(): string[][] {
        throw new Error("Not implemented.");
    }

    protected deserialize(input: string[][]) {
        // input[0..2]: standard order parameters (maxRequestCount, minSignatures, securityClass)
        // input[3]: segment-specific params [maxDays, allAccountsFlag, anotherFlag, camtFormat]
        if (input[3]) {
            this.maxDays = parseInt(input[3][0], 10) || 0;
            this.camtFormat = input[3][3] || "";
        }
    }
}
