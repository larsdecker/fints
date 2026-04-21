/**
 * Unit tests for the HKCSE (Scheduled Credit Transfer) segment.
 */
import { HKCSE } from "../hkcse";
import { HICSE } from "../hicse";
import { HICSES } from "../hicses";

const testAccount = {
    iban: "DE89370400440532013000",
    bic: "SSKNDE77XXX",
    accountNumber: "0532013000",
    subAccount: "",
    blz: "76050101",
};

const testPainXml = `<?xml version="1.0" encoding="UTF-8"?><Document>...</Document>`;

describe("HKCSE (Scheduled SEPA Credit Transfer Request Segment)", () => {
    it("serializes with the correct segment type", () => {
        const segment = new HKCSE({
            segNo: 3,
            version: 1,
            account: testAccount,
            painDescriptor: "urn:iso:std:iso:20022:tech:xsd:pain.001.003.03",
            painMessage: testPainXml,
        });
        expect(segment.toString()).toMatch(/^HKCSE:3:1\+/);
    });

    it("includes the IBAN and BIC in the serialized form", () => {
        const segment = new HKCSE({
            segNo: 3,
            version: 1,
            account: testAccount,
            painDescriptor: "urn:iso:std:iso:20022:tech:xsd:pain.001.003.03",
            painMessage: testPainXml,
        });
        const str = segment.toString();
        expect(str).toContain(testAccount.iban);
        expect(str).toContain(testAccount.bic);
    });

    it("includes the pain descriptor", () => {
        const descriptor = "urn:iso:std:iso:20022:tech:xsd:pain.001.003.03";
        const segment = new HKCSE({
            segNo: 3,
            version: 1,
            account: testAccount,
            painDescriptor: descriptor,
            painMessage: testPainXml,
        });
        expect(segment.toString()).toContain(descriptor);
    });

    it("wraps the PAIN message with binary length notation", () => {
        const segment = new HKCSE({
            segNo: 3,
            version: 1,
            account: testAccount,
            painDescriptor: "urn:iso:std:iso:20022:tech:xsd:pain.001.003.03",
            painMessage: testPainXml,
        });
        const str = segment.toString();
        expect(str).toContain(`@${testPainXml.length}@${testPainXml}`);
    });

    it("throws on deserialize (not implemented)", () => {
        expect(() => {
            new HKCSE("HKCSE:3:1+DE89:BIC::::::+urn:pain+@3@xml'");
        }).toThrow();
    });
});

describe("HICSE (Scheduled Credit Transfer Acknowledgement)", () => {
    it("deserializes a task ID from the response", () => {
        const segment = new HICSE("HICSE:5:1:3+TASK-001'");
        expect(segment.taskId).toBe("TASK-001");
    });

    it("handles empty task ID gracefully", () => {
        const segment = new HICSE("HICSE:5:1:3+'");
        expect(segment.taskId).toBeUndefined();
    });

    it("handles missing fields gracefully", () => {
        const segment = new HICSE("HICSE:5:1:3'");
        expect(segment.taskId).toBeUndefined();
    });

    it("throws on serialize (not implemented)", () => {
        const segment = new HICSE("HICSE:5:1:3+TASK-001'");
        expect(() => segment.toString()).toThrow();
    });
});

describe("HICSES (Scheduled Credit Transfer Parameters)", () => {
    it("deserializes maxRequestCount and minSignatures", () => {
        const segment = new HICSES("HICSES:12:1+1+1'");
        expect(segment.maxRequestCount).toBe(1);
        expect(segment.minSignatures).toBe(1);
    });

    it("deserializes larger values correctly", () => {
        const segment = new HICSES("HICSES:12:1+99+2'");
        expect(segment.maxRequestCount).toBe(99);
        expect(segment.minSignatures).toBe(2);
    });

    it("throws on serialize (not implemented)", () => {
        const segment = new HICSES("HICSES:12:1+1+1'");
        expect(() => segment.toString()).toThrow();
    });
});
