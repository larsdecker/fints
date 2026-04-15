import { buildSegment, buildMessage, buildHIRMG, buildHIRMS, buildHISPA, buildHISAL } from "../message-builder";
import { parse, parseSegment } from "../protocol";

describe("message-builder", () => {
    describe("buildSegment", () => {
        it("should build a simple segment", () => {
            const seg = buildSegment("HNHBS", 5, 1, ["1"]);
            expect(seg).toBe("HNHBS:5:1+1'");
        });

        it("should build segment with data group arrays", () => {
            const seg = buildSegment("HKIDN", 2, 2, [["280", "12345678"], "user", "0", "1"]);
            expect(seg).toBe("HKIDN:2:2+280:12345678+user+0+1'");
        });

        it("should build segment with reference", () => {
            const seg = buildSegment("HIRMS", 4, 2, [["0020", "", "text"]], 3);
            expect(seg).toBe("HIRMS:4:2:3+0020::text'");
        });
    });

    describe("buildMessage", () => {
        it("should build a complete message with envelope", () => {
            const msg = buildMessage({
                dialogId: "DIA_TEST",
                msgNo: 1,
                blz: "12345678",
                userName: "testuser",
                systemId: "SYS001",
                profileVersion: 1,
                innerSegments: [
                    buildHIRMG(3, [{ code: "0010", message: "OK" }]),
                ],
            });

            // Should start with HNHBK
            expect(msg.startsWith("HNHBK:1:3+")).toBe(true);
            // Should contain HNVSK
            expect(msg).toContain("HNVSK:998:3+");
            // Should contain HNVSD
            expect(msg).toContain("HNVSD:999:1+");
            // Should contain HNHBS
            expect(msg).toContain("HNHBS:");
            // Should contain our inner segment
            expect(msg).toContain("HIRMG:");
            // Should end with segment terminator
            expect(msg.endsWith("'")).toBe(true);
        });

        it("should be parseable by the FinTS parser", () => {
            const msg = buildMessage({
                dialogId: "DIA_TEST",
                msgNo: 1,
                blz: "12345678",
                userName: "testuser",
                systemId: "0",
                profileVersion: 1,
                innerSegments: [
                    buildHIRMG(3, [{ code: "0010", message: "OK" }]),
                    buildHIRMS(4, [{ code: "0020", message: "Auftrag ausgefuehrt" }], 3),
                ],
            });

            // Parse should not throw
            const segments = parse(msg);
            expect(segments.length).toBeGreaterThan(0);

            // First segment should be HNHBK
            const hnhbk = parseSegment(segments[0]);
            expect(hnhbk.type).toBe("HNHBK");
        });
    });

    describe("buildHISPA", () => {
        it("should build SEPA accounts segment", () => {
            const seg = buildHISPA(5, [
                { iban: "DE111234567800000001", bic: "GENODE00TES", accountNumber: "1", subAccount: "", blz: "12345678" },
            ], 3);

            expect(seg).toContain("HISPA:5:1:3+");
            expect(seg).toContain("DE111234567800000001");
            expect(seg).toContain("GENODE00TES");
        });
    });

    describe("buildHISAL", () => {
        it("should build balance segment", () => {
            const seg = buildHISAL(5, {
                accountNumber: "1",
                subAccount: "",
                blz: "12345678",
                productName: "Girokonto",
                currency: "EUR",
                bookedBalance: 1234.56,
                pendingBalance: 1234.56,
                creditLimit: 5000,
                availableBalance: 6234.56,
            }, 3);

            expect(seg).toContain("HISAL:5:7:3+");
            expect(seg).toContain("1234,56");
            expect(seg).toContain("Girokonto");
        });
    });
});
