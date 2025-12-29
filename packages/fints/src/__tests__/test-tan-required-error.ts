import { TanRequiredError, TanProcessStep } from "../errors/tan-required-error";
import { Dialog } from "../dialog";
import { HttpConnection } from "../http-connection";

describe("tan-required-error", () => {
    let mockDialog: Dialog;

    beforeEach(() => {
        const connection = new HttpConnection({
            url: "https://example.com/fints",
            debug: false,
            timeout: 30000,
            maxRetries: 3,
            retryDelay: 1000,
        });
        mockDialog = new Dialog(
            {
                blz: "12345678",
                name: "testuser",
                pin: "1234",
                systemId: "0",
                productId: "fints",
            },
            connection,
        );
    });

    describe("TanRequiredError", () => {
        test("should create error with basic information", () => {
            const error = new TanRequiredError(
                "TAN required",
                "ref123",
                "Please enter TAN",
                Buffer.from(""),
                mockDialog,
            );

            expect(error.message).toBe("TAN required");
            expect(error.transactionReference).toBe("ref123");
            expect(error.challengeText).toBe("Please enter TAN");
            expect(error.dialog).toBe(mockDialog);
        });

        test("should default to CHALLENGE_RESPONSE_NEEDED step", () => {
            const error = new TanRequiredError(
                "TAN required",
                "ref123",
                "Please enter TAN",
                Buffer.from(""),
                mockDialog,
            );

            expect(error.processStep).toBe(TanProcessStep.CHALLENGE_RESPONSE_NEEDED);
        });

        test("should accept custom process step", () => {
            const error = new TanRequiredError(
                "TAN required",
                "ref123",
                "Please enter TAN",
                Buffer.from(""),
                mockDialog,
                TanProcessStep.INITIAL,
            );

            expect(error.processStep).toBe(TanProcessStep.INITIAL);
        });

        test("should store triggering segment", () => {
            const error = new TanRequiredError(
                "TAN required",
                "ref123",
                "Please enter TAN",
                Buffer.from(""),
                mockDialog,
                TanProcessStep.CHALLENGE_RESPONSE_NEEDED,
                "HKKAZ",
            );

            expect(error.triggeringSegment).toBe("HKKAZ");
        });

        test("should store context information", () => {
            const context = {
                returnCode: "0030",
                requestSegments: ["HKKAZ"],
            };
            const error = new TanRequiredError(
                "TAN required",
                "ref123",
                "Please enter TAN",
                Buffer.from(""),
                mockDialog,
                TanProcessStep.CHALLENGE_RESPONSE_NEEDED,
                "HKKAZ",
                context,
            );

            expect(error.context).toEqual(context);
        });
    });

    describe("isMultiStep", () => {
        test("should return false for completed step", () => {
            const error = new TanRequiredError(
                "TAN required",
                "ref123",
                "Please enter TAN",
                Buffer.from(""),
                mockDialog,
                TanProcessStep.COMPLETED,
            );

            expect(error.isMultiStep()).toBe(false);
        });

        test("should return true for non-completed steps", () => {
            const steps = [
                TanProcessStep.INITIAL,
                TanProcessStep.CHALLENGE_SENT,
                TanProcessStep.CHALLENGE_RESPONSE_NEEDED,
            ];

            steps.forEach((step) => {
                const error = new TanRequiredError(
                    "TAN required",
                    "ref123",
                    "Please enter TAN",
                    Buffer.from(""),
                    mockDialog,
                    step,
                );
                expect(error.isMultiStep()).toBe(true);
            });
        });
    });

    describe("getStepDescription", () => {
        test("should return description for INITIAL step", () => {
            const error = new TanRequiredError(
                "TAN required",
                "ref123",
                "Please enter TAN",
                Buffer.from(""),
                mockDialog,
                TanProcessStep.INITIAL,
            );

            expect(error.getStepDescription()).toBe("TAN process initiated");
        });

        test("should return description for CHALLENGE_SENT step", () => {
            const error = new TanRequiredError(
                "TAN required",
                "ref123",
                "Please enter TAN",
                Buffer.from(""),
                mockDialog,
                TanProcessStep.CHALLENGE_SENT,
            );

            expect(error.getStepDescription()).toBe("TAN challenge has been sent");
        });

        test("should return description for CHALLENGE_RESPONSE_NEEDED step", () => {
            const error = new TanRequiredError(
                "TAN required",
                "ref123",
                "Please enter TAN",
                Buffer.from(""),
                mockDialog,
                TanProcessStep.CHALLENGE_RESPONSE_NEEDED,
            );

            expect(error.getStepDescription()).toBe("TAN response required");
        });

        test("should return description for COMPLETED step", () => {
            const error = new TanRequiredError(
                "TAN required",
                "ref123",
                "Please enter TAN",
                Buffer.from(""),
                mockDialog,
                TanProcessStep.COMPLETED,
            );

            expect(error.getStepDescription()).toBe("TAN process completed");
        });
    });

    describe("isDecoupledTan", () => {
        test("should return false when decoupledTanState is not set", () => {
            const error = new TanRequiredError(
                "TAN required",
                "ref123",
                "Please enter TAN",
                Buffer.from(""),
                mockDialog,
            );

            expect(error.isDecoupledTan()).toBe(false);
        });

        test("should return true when decoupledTanState is set", () => {
            const error = new TanRequiredError(
                "TAN required",
                "ref123",
                "Please enter TAN",
                Buffer.from(""),
                mockDialog,
            );
            error.decoupledTanState = "initiated" as any;

            expect(error.isDecoupledTan()).toBe(true);
        });
    });
});
