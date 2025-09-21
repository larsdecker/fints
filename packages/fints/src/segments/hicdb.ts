import { SegmentClass } from "./segment";
import { StandingOrder } from "../types";
import { Parse } from "../parse";
import type { Pain001Document } from "../pain-formats";
import { parseStandingOrderPain001 } from "../pain-formats";
import { parseStandingOrderSchedule } from "./standing-order-utils";

export class HICDBProps {
    public segNo: number;
    public standingOrder: StandingOrder;
}

/**
 * HICDB (SEPA-Dauerauftragsbestand rückmelden)
 * Section C.10.2.3.4
 */
export class HICDB extends SegmentClass(HICDBProps) {
    public type = "HICDB";

    protected serialize(): string[][] { throw new Error("Not implemented."); }

    protected deserialize(input: string[][]) {
        const [accountData = [], , [sepaMessage], orderData = [], scheduleData = []] = input;
        const [iban = "", bic = ""] = accountData;
        const [orderId] = orderData;
        const schedule = parseStandingOrderSchedule(scheduleData);

        const parsed: unknown = Parse.xml(sepaMessage);

        if (!this.isDocument(parsed)) {
            throw new Error("Received sepa-message seems not to be a valid 'Document' object!");
        }

        const jsonMessage = parsed.Document.CstmrCdtTrfInitn;
        const base = parseStandingOrderPain001(sepaMessage);

        this.standingOrder = {
            nextOrderDate: schedule.nextOrderDate,
            timeUnit: schedule.timeUnit,
            interval: schedule.interval,
            orderDay: schedule.orderDay,
            lastOrderDate: schedule.lastOrderDate || undefined,
            creationDate: base.creationDate,
            amount: base.amount || jsonMessage.GrpHdr.CtrlSum,
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

    private isDocument(d: any): d is Pain001Document {
        return typeof d !== "undefined"
            && typeof d.Document !== "undefined"
            && typeof d.Document.CstmrCdtTrfInitn !== "undefined";
    }
}
