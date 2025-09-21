import { Format } from "../format";
import { SegmentClass } from "./segment";

export class HICCSProps {
    public segNo: number;
    public version: number;
    public orderId?: string;
    public consentCode?: string;
    public orderStatus?: string;
}

/**
 * HICCS (SEPA credit transfer response)
 * Section C.10.2.1 b)
 */
export class HICCS extends SegmentClass(HICCSProps) {
    public type = "HICCS";

    protected defaults() {
        this.version = 1;
    }

    protected serialize() {
        return [
            Format.stringEscaped(this.orderId),
            Format.stringEscaped(this.consentCode),
            Format.stringEscaped(this.orderStatus),
        ];
    }

    protected deserialize(input: string[][]) {
        if (input[0] && input[0][0]) {
            this.orderId = input[0][0] || undefined;
        }
        if (input[1] && input[1][0]) {
            this.consentCode = input[1][0] || undefined;
        }
        if (input[2] && input[2][0]) {
            this.orderStatus = input[2][0] || undefined;
        }
    }
}
