import {
    FINTS_ERROR_CODES,
    getErrorCodeInfo,
    isSuccessCode,
    isWarningCode,
    isErrorCode,
    formatErrorCode,
} from "../error-codes";

describe("error-codes", () => {
    describe("getErrorCodeInfo", () => {
        test("should return info for known success code", () => {
            const info = getErrorCodeInfo("0010");
            expect(info).toBeDefined();
            expect(info?.code).toBe("0010");
            expect(info?.category).toBe("success");
            expect(info?.message).toBe("Nachricht entgegengenommen");
        });

        test("should return info for known warning code", () => {
            const info = getErrorCodeInfo("3040");
            expect(info).toBeDefined();
            expect(info?.code).toBe("3040");
            expect(info?.category).toBe("warning");
        });

        test("should return info for known error code", () => {
            const info = getErrorCodeInfo("9942");
            expect(info).toBeDefined();
            expect(info?.code).toBe("9942");
            expect(info?.category).toBe("error");
        });

        test("should return undefined for unknown code", () => {
            const info = getErrorCodeInfo("9999");
            expect(info).toBeUndefined();
        });
    });

    describe("isSuccessCode", () => {
        test("should identify success codes", () => {
            expect(isSuccessCode("0010")).toBe(true);
            expect(isSuccessCode("0020")).toBe(true);
            expect(isSuccessCode("0100")).toBe(true);
        });

        test("should not identify warning codes as success", () => {
            expect(isSuccessCode("3040")).toBe(false);
        });

        test("should not identify error codes as success", () => {
            expect(isSuccessCode("9010")).toBe(false);
        });
    });

    describe("isWarningCode", () => {
        test("should identify warning codes", () => {
            expect(isWarningCode("3010")).toBe(true);
            expect(isWarningCode("3040")).toBe(true);
            expect(isWarningCode("3920")).toBe(true);
        });

        test("should not identify success codes as warning", () => {
            expect(isWarningCode("0010")).toBe(false);
        });

        test("should not identify error codes as warning", () => {
            expect(isWarningCode("9010")).toBe(false);
        });
    });

    describe("isErrorCode", () => {
        test("should identify error codes", () => {
            expect(isErrorCode("9010")).toBe(true);
            expect(isErrorCode("9110")).toBe(true);
            expect(isErrorCode("9942")).toBe(true);
        });

        test("should not identify success codes as error", () => {
            expect(isErrorCode("0010")).toBe(false);
        });

        test("should not identify warning codes as error", () => {
            expect(isErrorCode("3010")).toBe(false);
        });
    });

    describe("formatErrorCode", () => {
        test("should format known error code with mapped message", () => {
            const formatted = formatErrorCode("9942");
            expect(formatted).toContain("[9942]");
            expect(formatted).toContain("PIN");
        });

        test("should format known error code with original message", () => {
            const formatted = formatErrorCode("0010", "Custom message");
            expect(formatted).toContain("[0010]");
            expect(formatted).toContain("Nachricht entgegengenommen");
        });

        test("should format unknown error code", () => {
            const formatted = formatErrorCode("9999", "Unknown error");
            expect(formatted).toContain("[9999]");
            expect(formatted).toContain("Unknown error");
        });

        test("should handle error code without original message", () => {
            const formatted = formatErrorCode("9999");
            expect(formatted).toContain("[9999]");
            expect(formatted).toContain("Unknown error code");
        });
    });

    describe("FINTS_ERROR_CODES", () => {
        test("should contain TAN-related codes", () => {
            expect(FINTS_ERROR_CODES["0030"]).toBeDefined();
            expect(FINTS_ERROR_CODES["3920"]).toBeDefined();
        });

        test("should contain authentication error codes", () => {
            expect(FINTS_ERROR_CODES["9110"]).toBeDefined();
            expect(FINTS_ERROR_CODES["9942"]).toBeDefined();
        });

        test("should contain dialog error codes", () => {
            expect(FINTS_ERROR_CODES["9380"]).toBeDefined();
            expect(FINTS_ERROR_CODES["9800"]).toBeDefined();
        });

        test("should contain PSD2 strong authentication codes", () => {
            expect(FINTS_ERROR_CODES["3076"]).toBeDefined();
            expect(FINTS_ERROR_CODES["3956"]).toBeDefined();
        });
    });
});
