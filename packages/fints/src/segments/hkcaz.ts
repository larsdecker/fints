import { Format } from "../format";
import { SegmentClass } from "./segment";
import { SEPAAccount } from "../types";
import { COUNTRY_CODE } from "../constants";

export class HKCAZProps {
    public segNo: number;
    public version: number;
    public account: SEPAAccount;
    public startDate: Date;
    public endDate: Date;
    public camtFormat: string;
    public touchdown: string;
}

/**
 * HKCAZ (Request CAMT account transactions)
 */
export class HKCAZ extends SegmentClass(HKCAZProps) {
    public type = "HKCAZ";

    protected serialize() {
        const { account, endDate, startDate, camtFormat, touchdown } = this;
        const { iban, bic, accountNumber, subAccount, blz } = account;
        const serializedAccount = [iban, bic, accountNumber, subAccount, String(COUNTRY_CODE), blz];
        return [
            serializedAccount,
            Format.stringEscaped(camtFormat),
            Format.jn(false),
            Format.date(startDate),
            Format.date(endDate),
            Format.empty(),
            Format.stringEscaped(touchdown),
        ];
    }

    protected deserialize() {
        throw new Error("Not implemented.");
    }
}
