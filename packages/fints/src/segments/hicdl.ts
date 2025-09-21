import { SegmentClass } from "./segment";
import { StandingOrder } from "../types";
import { parseStandingOrderPain001 } from "../pain-formats";
import { parseStandingOrderSchedule } from "./standing-order-utils";

export class HICDLProps {
    public segNo: number;
    public standingOrder: StandingOrder;
}

/**
 * HICDL (SEPA-Dauerauftrag löschen Rückmeldung)
 */
export class HICDL extends SegmentClass(HICDLProps) {
    public type = "HICDL";

    protected serialize(): string[][] { throw new Error("Not implemented."); }

    protected deserialize(input: string[][]) {
        const [
            [ iban, bic ],
            [],
            sepaGroup,
            [ orderId ],
            schedule,
        ] = input;

        const sepaMessage = sepaGroup && sepaGroup[0];
        const base = sepaMessage ? parseStandingOrderPain001(sepaMessage) : null;
        const scheduleInfo = parseStandingOrderSchedule(schedule);

        this.standingOrder = {
            nextOrderDate: scheduleInfo.nextOrderDate,
            timeUnit: scheduleInfo.timeUnit,
            interval: scheduleInfo.interval,
            orderDay: scheduleInfo.orderDay,
            lastOrderDate: scheduleInfo.lastOrderDate || undefined,
            creationDate: base ? base.creationDate : new Date(),
            amount: base ? base.amount : 0,
            paymentPurpose: base ? base.paymentPurpose : "",
            debitor: base ? base.debitor : { name: "", iban, bic },
            creditor: base ? base.creditor : { name: "", iban: "", bic: "" },
            orderId: orderId || undefined,
            currency: base ? base.currency : undefined,
        };
    }
}
