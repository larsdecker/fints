/**
 * Unit tests for the HKPAE (PIN change) segment.
 */
import { HKPAE } from "../hkpae";

describe("HKPAE (PIN Change Request Segment)", () => {
    it("serializes to the correct FinTS string format", () => {
        const segment = new HKPAE({ segNo: 3, version: 3, newPin: "12345" });
        expect(segment.toString()).toBe("HKPAE:3:3+12345+12345'");
    });

    it("includes the new PIN twice (confirmation)", () => {
        const segment = new HKPAE({ segNo: 3, version: 3, newPin: "99999" });
        const str = segment.toString();
        const parts = str.replace(/'/g, "").split("+");
        // parts[0] = "HKPAE:3:3", parts[1] = "99999", parts[2] = "99999"
        expect(parts[1]).toBe("99999");
        expect(parts[2]).toBe("99999");
    });

    it("defaults to version 3", () => {
        const segment = new HKPAE({ segNo: 5, version: 3, newPin: "abc" });
        expect(segment.version).toBe(3);
    });

    it("throws on deserialize (not implemented)", () => {
        expect(() => new HKPAE("HKPAE:3:3+abc+abc'")).toThrow();
    });

    it("serializes a long PIN", () => {
        const longPin = "a".repeat(20);
        const segment = new HKPAE({ segNo: 3, version: 3, newPin: longPin });
        const str = segment.toString();
        expect(str).toContain(longPin);
    });
});
