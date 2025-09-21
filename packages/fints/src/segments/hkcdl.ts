import { Format } from "../format";
import { SEPAAccount, StandingOrderSchedule } from "../types";
import { SegmentClass } from "./segment";
import { serializeStandingOrderSchedule } from "./standing-order-utils";

export class HKCDLProps {
    public segNo: number;
    public version: number;
    public account: SEPAAccount;
    public painDescriptor?: string;
    public sepaMessage?: string;
    public schedule?: StandingOrderSchedule;
    public orderId?: string;
}

/**
 * HKCDL (SEPA-Dauerauftrag löschen)
 */
export class HKCDL extends SegmentClass(HKCDLProps) {
    public type = "HKCDL";

    protected serialize() {
        const { account, painDescriptor, sepaMessage, schedule, orderId } = this;
        return [
            [account.iban, account.bic],
            [painDescriptor || Format.sepaDescriptor()],
            [sepaMessage ? Format.stringWithLength(sepaMessage) : Format.empty()],
            [orderId ? Format.stringEscaped(orderId) : Format.empty()],
            serializeStandingOrderSchedule(schedule),
        ];
    }

    protected deserialize(): void { throw new Error("Not implemented."); }
}
