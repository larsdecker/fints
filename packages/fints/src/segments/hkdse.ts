import { Format } from "../format";
import { SEPAAccount } from "../types";
import { SegmentClass } from "./segment";

export class HKDSEProps {
    public segNo: number;
    public version: number;
    public account: SEPAAccount;
    public painDescriptor: string;
    public painMessage: string;
}

/**
 * HKDSE (Einreichung terminierter SEPA-Einzellastschrift)
 */
export class HKDSE extends SegmentClass(HKDSEProps) {
    public type = "HKDSE";

    protected serialize() {
        const { account, painDescriptor, painMessage } = this;
        const { iban, bic } = account;
        return [[iban, bic], painDescriptor, Format.stringWithLength(painMessage)];
    }

    protected deserialize(): string[][] {
        throw new Error("Not implemented.");
    }
}
