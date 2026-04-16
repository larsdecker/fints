import { SegmentClass } from "./segment";

export class HKPAEProps {
    public segNo: number;
    public version: number;
    public newPin: string;
}

/**
 * HKPAE (Neue persönliche Kennung anfordern / PIN-Änderung)
 * FinTS 3.0 PIN/TAN spec §C.4.1
 *
 * Requests a PIN change. The old (current) PIN is supplied via the standard
 * HNSHA signature segment so it does not appear here. Version 3 requires the
 * new PIN to be submitted twice for confirmation.
 */
export class HKPAE extends SegmentClass(HKPAEProps) {
    public type = "HKPAE";

    protected defaults() {
        this.version = 3;
    }

    protected serialize() {
        const { newPin } = this;
        return [newPin, newPin];
    }

    protected deserialize(): void {
        throw new Error("Not implemented.");
    }
}
