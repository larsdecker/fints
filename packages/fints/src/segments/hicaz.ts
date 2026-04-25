import { SegmentClass } from "./segment";

export class HICAZProps {
    public segNo: number;
    public bookedTransactions: string;
    public pendingTransactions: string;
}

/**
 * HICAZ (CAMT account transactions response)
 */
export class HICAZ extends SegmentClass(HICAZProps) {
    public type = "HICAZ";

    protected serialize(): string[][] {
        throw new Error("Not implemented.");
    }

    protected deserialize(input: string[][]) {
        // HICAZ1 layout: [account, camtDescriptor, bookedTransactions, pendingTransactions?]
        const bookedTransactions = input[2];
        const pendingTransactions = input[3];
        if (bookedTransactions?.[0]) {
            this.bookedTransactions = bookedTransactions[0];
        }
        if (pendingTransactions?.[0]) {
            this.pendingTransactions = pendingTransactions[0];
        }
    }
}
