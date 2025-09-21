import { Format } from "../format";
import { SEPAAccount, StandingOrderSchedule } from "../types";
import { SegmentClass } from "./segment";
import { serializeStandingOrderSchedule } from "./standing-order-utils";

export class HKCDAProps {
    public segNo: number;
    public version: number;
    public account: SEPAAccount;
    public painDescriptor?: string;
    public sepaMessage: string;
    public schedule: StandingOrderSchedule;
}

/**
 * HKCDA (SEPA-Dauerauftrag anlegen)
 */
export class HKCDA extends SegmentClass(HKCDAProps) {
    public type = "HKCDA";

    protected serialize() {
        const { account, painDescriptor, sepaMessage, schedule } = this;
        return [
            [account.iban, account.bic],
            [painDescriptor || Format.sepaDescriptor()],
            [Format.stringWithLength(sepaMessage)],
            [Format.empty()],
            serializeStandingOrderSchedule(schedule),
        ];
    }

    protected deserialize(): void { throw new Error("Not implemented."); }
}
