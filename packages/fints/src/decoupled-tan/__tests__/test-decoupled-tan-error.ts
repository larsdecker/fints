import { DecoupledTanError } from "../../errors/decoupled-tan-error";
import { DecoupledTanState, DecoupledTanStatus } from "../types";

describe("DecoupledTanError", () => {
    let mockStatus: DecoupledTanStatus;

    beforeEach(() => {
        mockStatus = {
            state: DecoupledTanState.FAILED,
            transactionReference: "ref123",
            challengeText: "Please confirm",
            statusRequestCount: 5,
            maxStatusRequests: 60,
            startTime: new Date(),
            errorMessage: "Test error",
        };
    });

    describe("Constructor", () => {
        test("should create error with status information", () => {
            const error = new DecoupledTanError("Test error", mockStatus);

            expect(error.message).toBe("Test error");
            expect(error.state).toBe(DecoupledTanState.FAILED);
            expect(error.transactionReference).toBe("ref123");
            expect(error.remainingStatusRequests).toBe(55);
            expect(error.status).toEqual(mockStatus);
        });

        test("should include return code if provided", () => {
            const error = new DecoupledTanError("Test error", mockStatus, "9999");

            expect(error.returnCode).toBe("9999");
        });

        test("should have correct error name", () => {
            const error = new DecoupledTanError("Test error", mockStatus);

            expect(error.name).toBe("DecoupledTanError");
        });
    });

    describe("getUserMessage", () => {
        test("should return user-friendly message for TIMED_OUT state", () => {
            mockStatus.state = DecoupledTanState.TIMED_OUT;
            const error = new DecoupledTanError("Timeout", mockStatus);

            const message = error.getUserMessage();

            expect(message).toContain("timed out");
            expect(message).toContain("ref123");
        });

        test("should return user-friendly message for CANCELLED state", () => {
            mockStatus.state = DecoupledTanState.CANCELLED;
            const error = new DecoupledTanError("Cancelled", mockStatus);

            const message = error.getUserMessage();

            expect(message).toContain("cancelled");
            expect(message).toContain("ref123");
        });

        test("should return user-friendly message for FAILED state", () => {
            mockStatus.state = DecoupledTanState.FAILED;
            const error = new DecoupledTanError("Failed", mockStatus);

            const message = error.getUserMessage();

            expect(message).toContain("failed");
            expect(message).toContain("Failed");
            expect(message).toContain("ref123");
        });

        test("should return generic message for unknown state", () => {
            mockStatus.state = DecoupledTanState.INITIATED;
            const error = new DecoupledTanError("Error", mockStatus);

            const message = error.getUserMessage();

            expect(message).toContain("initiated");
            expect(message).toContain("Error");
        });
    });

    describe("Helper methods", () => {
        test("isTimeout should return true for TIMED_OUT state", () => {
            mockStatus.state = DecoupledTanState.TIMED_OUT;
            const error = new DecoupledTanError("Timeout", mockStatus);

            expect(error.isTimeout()).toBe(true);
        });

        test("isTimeout should return false for other states", () => {
            mockStatus.state = DecoupledTanState.FAILED;
            const error = new DecoupledTanError("Error", mockStatus);

            expect(error.isTimeout()).toBe(false);
        });

        test("isCancelled should return true for CANCELLED state", () => {
            mockStatus.state = DecoupledTanState.CANCELLED;
            const error = new DecoupledTanError("Cancelled", mockStatus);

            expect(error.isCancelled()).toBe(true);
        });

        test("isCancelled should return false for other states", () => {
            mockStatus.state = DecoupledTanState.FAILED;
            const error = new DecoupledTanError("Error", mockStatus);

            expect(error.isCancelled()).toBe(false);
        });

        test("hasRemainingRequests should return true when requests remain", () => {
            mockStatus.statusRequestCount = 10;
            mockStatus.maxStatusRequests = 60;
            const error = new DecoupledTanError("Error", mockStatus);

            expect(error.hasRemainingRequests()).toBe(true);
            expect(error.remainingStatusRequests).toBe(50);
        });

        test("hasRemainingRequests should return false when no requests remain", () => {
            mockStatus.statusRequestCount = 60;
            mockStatus.maxStatusRequests = 60;
            const error = new DecoupledTanError("Error", mockStatus);

            expect(error.hasRemainingRequests()).toBe(false);
            expect(error.remainingStatusRequests).toBe(0);
        });
    });
});
