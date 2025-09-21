import { Format } from "../format";
import { SEPAAccount, StandingOrderSchedule } from "../types";
import { SegmentClass } from "./segment";
import { serializeStandingOrderSchedule } from "./standing-order-utils";

export class HKCDEProps {
    public segNo: number;
    public version: number;
    public account: SEPAAccount;
    public painDescriptor?: string;
    public sepaMessage: string;
    public schedule?: StandingOrderSchedule;
    public orderId: string;
}

/**
 * HKCDE (SEPA-Dauerauftrag ändern)
 */
export class HKCDE extends SegmentClass(HKCDEProps) {
    public type = "HKCDE";

    protected serialize() {
        const { account, painDescriptor, sepaMessage, schedule, orderId } = this;
        if (!orderId) { throw new Error("orderId is required for HKCDE"); }
        return [
            [account.iban, account.bic],
            [painDescriptor || Format.sepaDescriptor()],
            [Format.stringWithLength(sepaMessage)],
            [Format.stringEscaped(orderId)],
            serializeStandingOrderSchedule(schedule),
        ];
    }

    protected deserialize(): void { throw new Error("Not implemented."); }
}
