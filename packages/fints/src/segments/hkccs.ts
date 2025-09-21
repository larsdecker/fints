import { Format } from "../format";
import { SegmentClass } from "./segment";
import { SEPAAccount } from "../types";
import { COUNTRY_CODE } from "../constants";

export class HKCCSProps {
    public segNo: number;
    public version: number;
    public account: SEPAAccount;
    public painDescriptor: string;
    public painMessage: string;
}

/**
 * HKCCS (SEPA credit transfer request)
 */
export class HKCCS extends SegmentClass(HKCCSProps) {
    public type = "HKCCS";

    protected serialize() {
        const { account, painDescriptor, painMessage } = this;
        const { iban, bic, accountNumber, subAccount, blz } = account;
        return [
            [iban, bic, accountNumber, subAccount || "", String(COUNTRY_CODE), blz],
            painDescriptor,
            Format.stringWithLength(painMessage),
        ];
    }

    protected deserialize(): string[][] { throw new Error("Not implemented."); }
}
