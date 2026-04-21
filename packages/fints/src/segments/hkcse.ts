import { Format } from "../format";
import { SegmentClass } from "./segment";
import { SEPAAccount } from "../types";
import { COUNTRY_CODE } from "../constants";

export class HKCSEProps {
    public segNo: number;
    public version: number;
    public account: SEPAAccount;
    public painDescriptor: string;
    public painMessage: string;
}

/**
 * HKCSE (Terminierte SEPA-Einzelüberweisung einreichen / Scheduled SEPA credit transfer)
 * FinTS 3.0 Spec §C.3.x
 *
 * Submits a scheduled (future-dated) SEPA credit transfer. The desired execution
 * date is embedded inside the pain.001 XML message as ReqdExctnDt.
 */
export class HKCSE extends SegmentClass(HKCSEProps) {
    public type = "HKCSE";

    protected serialize() {
        const { account, painDescriptor, painMessage } = this;
        const { iban, bic, accountNumber, subAccount, blz } = account;
        return [
            [iban, bic, accountNumber, subAccount || "", String(COUNTRY_CODE), blz],
            painDescriptor,
            Format.stringWithLength(painMessage),
        ];
    }

    protected deserialize(): void {
        throw new Error("Not implemented.");
    }
}
