import { HNSHA } from "../hnsha";
import { testSegment } from "./utils";

testSegment(
    HNSHA,
    [
        {
            serialized: "HNSHA:173:2+12345678++12345'",
            structured: {
                type: "HNSHA",
                segNo: 173,
                version: 2,
                msgNo: 1,
                secRef: 12345678,
                pin: "12345",
            },
        },
        {
            serialized: "HNSHA:173:2+12345678++12345:123456'",
            structured: {
                type: "HNSHA",
                segNo: 173,
                version: 2,
                msgNo: 1,
                secRef: 12345678,
                pin: "12345",
                tan: "123456",
            },
        },
    ],
    "out",
);

// Security test: ensure PIN and TAN are masked in debug output
describe("HNSHA Security", () => {
    it("should mask PIN in debugString", () => {
        const segment = new HNSHA({
            segNo: 173,
            secRef: 99999999,
            pin: "SECRET_PIN",
            tan: undefined,
        });
        const debug = segment.debugString;
        expect(debug).not.toContain("SECRET_PIN");
        expect(debug).toContain("***MASKED***");
        expect(debug).toContain("99999999"); // secRef should not be masked
    });

    it("should mask both PIN and TAN in debugString", () => {
        const segment = new HNSHA({
            segNo: 173,
            secRef: 88888888,
            pin: "SECRET_PIN",
            tan: "SECRET_TAN",
        });
        const debug = segment.debugString;
        expect(debug).not.toContain("SECRET_PIN");
        expect(debug).not.toContain("SECRET_TAN");
        expect(debug).toContain("***MASKED***");
        expect(debug).toContain("88888888"); // secRef should not be masked
    });

    it("should still expose PIN/TAN in toString for actual transmission", () => {
        const segment = new HNSHA({
            segNo: 173,
            secRef: 12345678,
            pin: "SECRET_PIN",
            tan: "SECRET_TAN",
        });
        const serialized = segment.toString();
        // toString should still contain the actual values for transmission
        expect(serialized).toContain("SECRET_PIN");
        expect(serialized).toContain("SECRET_TAN");
    });
});
