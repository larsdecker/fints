import { SegmentClass } from "./segment";
import { StandingOrder } from "../types";
import { parseStandingOrderPain001 } from "../pain-formats";
import { parseStandingOrderSchedule } from "./standing-order-utils";

export class HICDAProps {
    public segNo: number;
    public standingOrder: StandingOrder;
}

/**
 * HICDA (SEPA-Dauerauftrag anlegen Rückmeldung)
 */
export class HICDA extends SegmentClass(HICDAProps) {
    public type = "HICDA";

    protected serialize(): string[][] { throw new Error("Not implemented."); }

    protected deserialize(input: string[][]) {
        const [
            [ iban, bic ],
            [],
            [ sepaMessage ],
            [ orderId ],
            schedule,
        ] = input;

        const base = parseStandingOrderPain001(sepaMessage);
        const scheduleInfo = parseStandingOrderSchedule(schedule);

        this.standingOrder = {
            nextOrderDate: scheduleInfo.nextOrderDate,
            timeUnit: scheduleInfo.timeUnit,
            interval: scheduleInfo.interval,
            orderDay: scheduleInfo.orderDay,
            lastOrderDate: scheduleInfo.lastOrderDate || undefined,
            creationDate: base.creationDate,
            amount: base.amount,
            paymentPurpose: base.paymentPurpose,
            debitor: {
                name: base.debitor.name || "",
                iban: base.debitor.iban || iban,
                bic: base.debitor.bic || bic,
            },
            creditor: base.creditor,
            orderId: orderId || undefined,
            currency: base.currency,
        };
    }
}
