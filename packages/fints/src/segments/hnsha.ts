import { SegmentClass } from "./segment";
import { Format } from "../format";

export class HNSHAProps {
    public segNo: number;
    public secRef: number;
    public pin: string;
    public tan: string;
}

/**
 * HNSHA (Signaturabschluss)
 * Section B.5.2
 */
export class HNSHA extends SegmentClass(HNSHAProps) {
    public type = "HNSHA";

    protected defaults() {
        this.version = 2;
    }

    protected serialize() {
        const { secRef, pin, tan } = this;
        return [Format.num(secRef), Format.empty(), tan ? [pin, tan] : pin];
    }

    protected deserialize() {
        throw new Error("Not implemented.");
    }

    /**
     * Override debugString to mask sensitive data (PIN/TAN).
     * This prevents credentials from being exposed in logs.
     */
    public get debugString() {
        const info =
            `Type: ${this.type}\n` +
            `Version: ${this.version}\n` +
            `Segment Number: ${this.segNo}\n` +
            `Referencing: ${this.reference === undefined ? "None" : this.reference}\n` +
            `----\n`;
        const { secRef, tan } = this;
        const maskedData = [
            Format.num(secRef),
            Format.empty(),
            tan ? ["***MASKED***", "***MASKED***"] : "***MASKED***",
        ];
        return maskedData.reduce((result, group, index) => {
            return `${result}DG ${index}: ${Array.isArray(group) ? group.join(", ") : group}\n`;
        }, info);
    }
}
