import {
    escapeXml,
    xmlElement,
    xmlEmptyElement,
    buildMsgHead,
    buildMsgTail,
    buildSecurityEnvelope,
    buildSegment,
    buildMessage,
    XmlSegment,
} from "../xml-builder";
import { FINTS_NAMESPACE, FINTS_VERSION, COUNTRY_CODE } from "../constants";
import { PRODUCT_NAME, PRODUCT_VERSION } from "../../constants";

describe("xml-builder", () => {
    describe("escapeXml", () => {
        it("escapes ampersands", () => {
            expect(escapeXml("foo & bar")).toBe("foo &amp; bar");
        });

        it("escapes angle brackets", () => {
            expect(escapeXml("<tag>")).toBe("&lt;tag&gt;");
        });

        it("escapes quotes", () => {
            expect(escapeXml('"hello"')).toBe("&quot;hello&quot;");
        });

        it("escapes apostrophes", () => {
            expect(escapeXml("it's")).toBe("it&apos;s");
        });

        it("handles empty string", () => {
            expect(escapeXml("")).toBe("");
        });

        it("handles string with no special characters", () => {
            expect(escapeXml("hello world")).toBe("hello world");
        });

        it("escapes multiple special characters", () => {
            expect(escapeXml("a & b < c > \"d\" & 'e'")).toBe(
                "a &amp; b &lt; c &gt; &quot;d&quot; &amp; &apos;e&apos;",
            );
        });
    });

    describe("xmlElement", () => {
        it("creates a simple element", () => {
            expect(xmlElement("Name", "value")).toBe("<Name>value</Name>");
        });

        it("creates an element with attributes", () => {
            const result = xmlElement("Tag", "content", { attr1: "val1", attr2: "val2" });
            expect(result).toBe('<Tag attr1="val1" attr2="val2">content</Tag>');
        });

        it("escapes attribute values", () => {
            const result = xmlElement("Tag", "content", { name: 'say "hi"' });
            expect(result).toBe('<Tag name="say &quot;hi&quot;">content</Tag>');
        });

        it("creates nested elements", () => {
            const inner = xmlElement("Inner", "text");
            const outer = xmlElement("Outer", inner);
            expect(outer).toBe("<Outer><Inner>text</Inner></Outer>");
        });
    });

    describe("xmlEmptyElement", () => {
        it("creates a self-closing element", () => {
            expect(xmlEmptyElement("Break")).toBe("<Break/>");
        });

        it("creates a self-closing element with attributes", () => {
            expect(xmlEmptyElement("Input", { type: "text" })).toBe('<Input type="text"/>');
        });
    });

    describe("buildMsgHead", () => {
        it("builds a valid message header", () => {
            const result = buildMsgHead({
                msgNo: 1,
                dialogId: "0",
                blz: "12345678",
                systemId: "0",
            });

            expect(result).toContain("<MsgHead>");
            expect(result).toContain("<MsgNo>1</MsgNo>");
            expect(result).toContain("<DialogID>0</DialogID>");
            expect(result).toContain(`<HBCIVersion>${FINTS_VERSION}</HBCIVersion>`);
            expect(result).toContain("<BLZ>12345678</BLZ>");
            expect(result).toContain(`<CountryCode>${COUNTRY_CODE}</CountryCode>`);
            expect(result).toContain("<SystemID>0</SystemID>");
            expect(result).toContain("</MsgHead>");
        });

        it("includes product information", () => {
            const result = buildMsgHead({
                msgNo: 1,
                dialogId: "0",
                blz: "12345678",
                systemId: "0",
                productId: "myProduct",
            });

            expect(result).toContain("<Name>myProduct</Name>");
            expect(result).toContain(`<Version>${PRODUCT_VERSION}</Version>`);
        });

        it("uses default product name when not specified", () => {
            const result = buildMsgHead({
                msgNo: 1,
                dialogId: "0",
                blz: "12345678",
                systemId: "0",
            });

            expect(result).toContain(`<Name>${PRODUCT_NAME}</Name>`);
        });

        it("escapes special characters in dialogId", () => {
            const result = buildMsgHead({
                msgNo: 1,
                dialogId: "id&special",
                blz: "12345678",
                systemId: "0",
            });

            expect(result).toContain("<DialogID>id&amp;special</DialogID>");
        });
    });

    describe("buildMsgTail", () => {
        it("builds a valid message tail", () => {
            const result = buildMsgTail(1);
            expect(result).toBe("<MsgTail><MsgNo>1</MsgNo></MsgTail>");
        });

        it("works with larger message numbers", () => {
            const result = buildMsgTail(42);
            expect(result).toBe("<MsgTail><MsgNo>42</MsgNo></MsgTail>");
        });
    });

    describe("buildSecurityEnvelope", () => {
        it("builds header and trailer with PIN", () => {
            const result = buildSecurityEnvelope({
                pin: "12345",
                name: "testuser",
                systemId: "sys1",
            });

            expect(result.header).toContain("<SignatureHeader>");
            expect(result.header).toContain("<SecurityFunction>999</SecurityFunction>");
            expect(result.header).toContain("<SecurityMethod>PIN_TAN</SecurityMethod>");
            expect(result.header).toContain("<UserID>testuser</UserID>");
            expect(result.header).toContain("<SystemID>sys1</SystemID>");

            expect(result.trailer).toContain("<SignatureTrailer>");
            expect(result.trailer).toContain("<PIN>12345</PIN>");
        });

        it("builds trailer with TAN", () => {
            const result = buildSecurityEnvelope({
                pin: "12345",
                tan: "678901",
                name: "user",
                systemId: "0",
            });

            expect(result.trailer).toContain("<PIN>12345</PIN>");
            expect(result.trailer).toContain("<TAN>678901</TAN>");
        });

        it("builds empty trailer without PIN or TAN", () => {
            const result = buildSecurityEnvelope({
                name: "user",
                systemId: "0",
            });

            expect(result.trailer).toBe("<SignatureTrailer></SignatureTrailer>");
        });

        it("uses custom security function", () => {
            const result = buildSecurityEnvelope({
                name: "user",
                systemId: "0",
                securityFunction: "912",
            });

            expect(result.header).toContain("<SecurityFunction>912</SecurityFunction>");
        });

        it("escapes special characters in credentials", () => {
            const result = buildSecurityEnvelope({
                pin: "pass&word",
                name: "user<name>",
                systemId: "0",
            });

            expect(result.trailer).toContain("<PIN>pass&amp;word</PIN>");
            expect(result.header).toContain("<UserID>user&lt;name&gt;</UserID>");
        });
    });

    describe("buildSegment", () => {
        it("builds a segment with header and body", () => {
            const segment: XmlSegment = {
                type: "TestSeg",
                version: 2,
                segNo: 3,
                body: "<Data>value</Data>",
            };

            const result = buildSegment(segment);
            expect(result).toContain("<Segment>");
            expect(result).toContain("<SegHead>");
            expect(result).toContain("<Type>TestSeg</Type>");
            expect(result).toContain("<Version>2</Version>");
            expect(result).toContain("<SegNo>3</SegNo>");
            expect(result).toContain("<SegBody><Data>value</Data></SegBody>");
            expect(result).toContain("</Segment>");
        });
    });

    describe("buildMessage", () => {
        it("builds a complete FinTS 4.1 XML message", () => {
            const result = buildMessage({
                msgNo: 1,
                dialogId: "0",
                segments: [
                    {
                        type: "TestSeg",
                        version: 1,
                        segNo: 1,
                        body: "<Data>test</Data>",
                    },
                ],
                blz: "12345678",
                name: "testuser",
                pin: "12345",
                systemId: "0",
            });

            expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(result).toContain(`<FinTSMessage xmlns="${FINTS_NAMESPACE}">`);
            expect(result).toContain("<MsgHead>");
            expect(result).toContain("<MsgBody>");
            expect(result).toContain("<MsgTail>");
            expect(result).toContain("<SignatureHeader>");
            expect(result).toContain("<SignatureTrailer>");
            expect(result).toContain("<Segment>");
            expect(result).toContain("</FinTSMessage>");
        });

        it("includes PIN in the security envelope", () => {
            const result = buildMessage({
                msgNo: 1,
                dialogId: "0",
                segments: [],
                blz: "12345678",
                name: "user",
                pin: "mypin",
                systemId: "0",
            });

            expect(result).toContain("<PIN>mypin</PIN>");
        });

        it("includes TAN when provided", () => {
            const result = buildMessage({
                msgNo: 1,
                dialogId: "0",
                segments: [],
                blz: "12345678",
                name: "user",
                pin: "mypin",
                systemId: "0",
                tan: "123456",
            });

            expect(result).toContain("<TAN>123456</TAN>");
        });

        it("includes multiple segments", () => {
            const result = buildMessage({
                msgNo: 1,
                dialogId: "0",
                segments: [
                    { type: "Seg1", version: 1, segNo: 1, body: "<A>1</A>" },
                    { type: "Seg2", version: 2, segNo: 2, body: "<B>2</B>" },
                ],
                blz: "12345678",
                name: "user",
                pin: "pin",
                systemId: "0",
            });

            expect(result).toContain("<Type>Seg1</Type>");
            expect(result).toContain("<Type>Seg2</Type>");
        });
    });
});
