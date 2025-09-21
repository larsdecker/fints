import { SegmentClass } from "./segment";
import { StandingOrder } from "../types";
import { Parse } from "../parse";
import type { document } from "../pain-formats";
import { parseStandingOrderPain001 } from "../pain-formats";

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
        const [
            [ iban, bic ],
            [],
            [ sepaMessage ],
            [ orderId ],
            [ nextOrder, timeUnit, interval, orderDay, lastOrder ],
        ] = input;

        const parsed: unknown = Parse.xml(sepaMessage);

        if (!this.isDocument(parsed)) {
            throw new Error("Received sepa-message seems not to be a valid 'Document' object!");
        }

        const jsonMessage = parsed.Document.CstmrCdtTrfInitn;
        const base = parseStandingOrderPain001(sepaMessage);

        this.standingOrder = {
            nextOrderDate: Parse.date(nextOrder),
            timeUnit,
            interval: Parse.num(interval),
            orderDay: Parse.num(orderDay),
            lastOrderDate: lastOrder ? Parse.date(lastOrder) : null,
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

    private isDocument(d: any): d is document {
        return typeof d !== "undefined"
            && typeof d.Document !== "undefined"
            && typeof d.Document.CstmrCdtTrfInitn !== "undefined";
    }
}
