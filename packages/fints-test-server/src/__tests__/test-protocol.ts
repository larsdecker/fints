import { parse, parseSegment, extractInnerSegments, encodeBase64, decodeBase64, escapeFinTS } from "../protocol";

describe("protocol", () => {
    describe("encodeBase64 / decodeBase64", () => {
        it("should round-trip ASCII text", () => {
            const input = "Hello World";
            expect(decodeBase64(encodeBase64(input))).toBe(input);
        });

        it("should handle FinTS special characters", () => {
            const input = "HNHBK:1:3+000000000123+300+0+1'";
            expect(decodeBase64(encodeBase64(input))).toBe(input);
        });

        it("should handle ISO-8859-1 characters (umlauts)", () => {
            const input = "Bankleitzahl: Ä Ö Ü ä ö ü ß";
            expect(decodeBase64(encodeBase64(input))).toBe(input);
        });
    });

    describe("parse", () => {
        it("should parse a simple segment", () => {
            const result = parse("HKSYN:4:2+0'");
            expect(result).toHaveLength(1);
            expect(result[0][0]).toEqual(["HKSYN", "4", "2"]);
            expect(result[0][1]).toEqual(["0"]);
        });

        it("should parse multiple segments", () => {
            const result = parse("HNHBS:6:1+1'HNHBS:7:1+2'");
            expect(result).toHaveLength(2);
        });

        it("should parse data groups with multiple elements", () => {
            const result = parse("HKIDN:2:2+280:12345678+user+0+1'");
            expect(result[0][0]).toEqual(["HKIDN", "2", "2"]);
            expect(result[0][1]).toEqual(["280", "12345678"]);
            expect(result[0][2]).toEqual(["user"]);
        });

        it("should handle escaped characters", () => {
            const result = parse("TEST:1:1+http?://example.com?:8080'");
            expect(result[0][1][0]).toBe("http://example.com:8080");
        });

        it("should handle binary data with length", () => {
            const result = parse("TEST:1:1+@5@Hello'");
            expect(result[0][1][0]).toBe("Hello");
        });

        it("should parse segment with reference", () => {
            const result = parse("HIRMS:4:2:3+0020::text'");
            expect(result[0][0]).toEqual(["HIRMS", "4", "2", "3"]);
        });

        it("should throw on string not ending with quote", () => {
            expect(() => parse("HKSYN:4:2+0")).toThrow("String must end with \"'\"");
        });
    });

    describe("parseSegment", () => {
        it("should extract type, segNo, version", () => {
            const raw = [["HKSYN", "4", "2"], ["0"]];
            const seg = parseSegment(raw);
            expect(seg.type).toBe("HKSYN");
            expect(seg.segNo).toBe(4);
            expect(seg.version).toBe(2);
            expect(seg.reference).toBeUndefined();
            expect(seg.dataGroups).toEqual([["0"]]);
        });

        it("should extract reference when present", () => {
            const raw = [["HIRMS", "4", "2", "3"], ["0020", "", "text"]];
            const seg = parseSegment(raw);
            expect(seg.reference).toBe(3);
        });
    });

    describe("extractInnerSegments", () => {
        it("should extract segments from HNVSD envelope", () => {
            const innerContent = "HKIDN:2:2+280:12345678+user+0+1'";
            const msg = `HNHBK:1:3+000000000200+300+0+1'HNVSK:998:3+PIN:1'HNVSD:999:1+@${innerContent.length}@${innerContent}'HNHBS:3:1+1'`;
            const segments = parse(msg).map(parseSegment);
            const inner = extractInnerSegments(segments);
            expect(inner.length).toBeGreaterThan(0);
            expect(inner[0].type).toBe("HKIDN");
        });
    });

    describe("escapeFinTS", () => {
        it("should escape control characters", () => {
            expect(escapeFinTS("a+b:c'd@e?f")).toBe("a?+b?:c?'d?@e??f");
        });

        it("should handle empty/undefined", () => {
            expect(escapeFinTS("")).toBe("");
        });
    });
});
