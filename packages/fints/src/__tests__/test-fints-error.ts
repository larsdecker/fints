import {
    FinTSError,
    AuthenticationError,
    OrderRejectedError,
    DialogAbortedError,
    MessageStructureError,
    PinError,
    StrongAuthenticationRequiredError,
    InvalidSystemIdError,
    createFinTSError,
} from "../errors/fints-error";
import { ReturnValue } from "../return-value";

describe("fints-error", () => {
    describe("FinTSError", () => {
        test("should create error with code", () => {
            const error = new FinTSError("Test error", "9999");
            expect(error.message).toBe("Test error");
            expect(error.code).toBe("9999");
            expect(error.name).toBe("FinTSError");
        });

        test("should create error without code", () => {
            const error = new FinTSError("Test error");
            expect(error.code).toBe("UNKNOWN");
        });

        test("should include return value", () => {
            const returnValue = new ReturnValue({
                code: "9999",
                message: "Test",
                parameters: [],
            });
            const error = new FinTSError("Test error", "9999", returnValue);
            expect(error.returnValue).toBe(returnValue);
        });
    });

    describe("createFinTSError", () => {
        test("should create PinError for code 9942", () => {
            const error = createFinTSError("9942", "PIN falsch");
            expect(error).toBeInstanceOf(PinError);
            expect(error.code).toBe("9942");
        });

        test("should create AuthenticationError for code 9110", () => {
            const error = createFinTSError("9110", "Kunde nicht berechtigt");
            expect(error).toBeInstanceOf(AuthenticationError);
            expect(error.code).toBe("9110");
        });

        test("should create StrongAuthenticationRequiredError for code 3076", () => {
            const error = createFinTSError("3076", "SCA notwendig");
            expect(error).toBeInstanceOf(StrongAuthenticationRequiredError);
            expect(error.code).toBe("3076");
        });

        test("should create StrongAuthenticationRequiredError for code 3956", () => {
            const error = createFinTSError("3956", "SCA notwendig");
            expect(error).toBeInstanceOf(StrongAuthenticationRequiredError);
            expect(error.code).toBe("3956");
        });

        test("should create OrderRejectedError for code 9340", () => {
            const error = createFinTSError("9340", "Auftrag abgelehnt");
            expect(error).toBeInstanceOf(OrderRejectedError);
            expect(error.code).toBe("9340");
        });

        test("should create DialogAbortedError for code 9380", () => {
            const error = createFinTSError("9380", "Dialog abgebrochen");
            expect(error).toBeInstanceOf(DialogAbortedError);
            expect(error.code).toBe("9380");
        });

        test("should create DialogAbortedError for code 9800", () => {
            const error = createFinTSError("9800", "Dialog abgebrochen");
            expect(error).toBeInstanceOf(DialogAbortedError);
            expect(error.code).toBe("9800");
        });

        test("should create MessageStructureError for code 9010", () => {
            const error = createFinTSError("9010", "Nachrichtenaufbau fehlerhaft");
            expect(error).toBeInstanceOf(MessageStructureError);
            expect(error.code).toBe("9010");
        });

        test("should create InvalidSystemIdError for code 9931", () => {
            const error = createFinTSError("9931", "System-ID ungültig");
            expect(error).toBeInstanceOf(InvalidSystemIdError);
            expect(error.code).toBe("9931");
        });

        test("should create generic FinTSError for unknown codes", () => {
            const error = createFinTSError("9999", "Unknown error");
            expect(error).toBeInstanceOf(FinTSError);
            expect(error).not.toBeInstanceOf(AuthenticationError);
            expect(error.code).toBe("9999");
        });
    });

    describe("error inheritance", () => {
        test("all error types should extend FinTSError", () => {
            expect(new AuthenticationError("test", "9110")).toBeInstanceOf(FinTSError);
            expect(new OrderRejectedError("test", "9340")).toBeInstanceOf(FinTSError);
            expect(new DialogAbortedError("test", "9800")).toBeInstanceOf(FinTSError);
            expect(new MessageStructureError("test", "9010")).toBeInstanceOf(FinTSError);
            expect(new PinError("test", "9942")).toBeInstanceOf(FinTSError);
            expect(new StrongAuthenticationRequiredError("test", "3076")).toBeInstanceOf(FinTSError);
            expect(new InvalidSystemIdError("test", "9931")).toBeInstanceOf(FinTSError);
        });

        test("all error types should extend Error", () => {
            expect(new AuthenticationError("test", "9110")).toBeInstanceOf(Error);
            expect(new FinTSError("test", "9999")).toBeInstanceOf(Error);
        });
    });
});
