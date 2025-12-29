import { DecoupledTanManager } from "../decoupled-tan-manager";
import { DecoupledTanState, DecoupledTanConfig } from "../types";
import { DecoupledTanError } from "../../errors/decoupled-tan-error";
import { Dialog } from "../../dialog";
import { HttpConnection } from "../../http-connection";
import { Response } from "../../response";
import { TanMethod } from "../../tan-method";

describe("DecoupledTanManager", () => {
    let mockDialog: Dialog;
    let mockConnection: HttpConnection;

    beforeEach(() => {
        mockConnection = new HttpConnection({
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
            mockConnection,
        );
        mockDialog.hktanVersion = 7;
        mockDialog.msgNo = 1;
        mockDialog.dialogId = "test-dialog-id";
    });

    describe("Constructor and initialization", () => {
        test("should initialize with default config", () => {
            const manager = new DecoupledTanManager("ref123", "Please confirm", mockDialog);

            const status = manager.getStatus();
            expect(status.state).toBe(DecoupledTanState.INITIATED);
            expect(status.transactionReference).toBe("ref123");
            expect(status.challengeText).toBe("Please confirm");
            expect(status.statusRequestCount).toBe(0);
            expect(status.maxStatusRequests).toBe(60);
        });

        test("should use custom config when provided", () => {
            const config: DecoupledTanConfig = {
                autoStartPolling: false,
                maxStatusRequests: 30,
                waitBeforeFirstStatusRequest: 1000,
                waitBetweenStatusRequests: 1500,
                totalTimeout: 120000,
            };

            const manager = new DecoupledTanManager("ref123", "Please confirm", mockDialog, config);

            const status = manager.getStatus();
            expect(status.maxStatusRequests).toBe(30);
        });

        test("should prefer server-provided values from TanMethod", () => {
            const tanMethod = new TanMethod(7);
            tanMethod.decoupledMaxStatusRequests = 45;
            tanMethod.decoupledWaitBeforeFirstStatusRequest = 3000;
            tanMethod.decoupledWaitBetweenStatusRequests = 2500;

            const config: DecoupledTanConfig = {
                maxStatusRequests: 30,
                waitBeforeFirstStatusRequest: 1000,
                waitBetweenStatusRequests: 1500,
            };

            const manager = new DecoupledTanManager("ref123", "Please confirm", mockDialog, config, tanMethod);

            const status = manager.getStatus();
            expect(status.maxStatusRequests).toBe(45);
        });
    });

    describe("State management", () => {
        test("should track state correctly", () => {
            const manager = new DecoupledTanManager("ref123", "Please confirm", mockDialog);

            expect(manager.isActive()).toBe(true);
            expect(manager.getStatus().state).toBe(DecoupledTanState.INITIATED);
        });

        test("should become inactive after cancellation", () => {
            const manager = new DecoupledTanManager("ref123", "Please confirm", mockDialog);

            manager.cancel();

            expect(manager.isActive()).toBe(false);
            expect(manager.getStatus().state).toBe(DecoupledTanState.CANCELLED);
        });

        test("should return status snapshot", () => {
            const manager = new DecoupledTanManager("ref123", "Please confirm", mockDialog);

            const status1 = manager.getStatus();
            const status2 = manager.getStatus();

            expect(status1).not.toBe(status2);
            expect(status1).toEqual(status2);
        });
    });

    describe("Cancellation", () => {
        test("should cancel active polling", () => {
            const manager = new DecoupledTanManager("ref123", "Please confirm", mockDialog);

            manager.cancel();

            expect(manager.getStatus().state).toBe(DecoupledTanState.CANCELLED);
            expect(manager.isActive()).toBe(false);
        });

        test("should be idempotent", () => {
            const manager = new DecoupledTanManager("ref123", "Please confirm", mockDialog);

            manager.cancel();
            manager.cancel();

            expect(manager.getStatus().state).toBe(DecoupledTanState.CANCELLED);
        });
    });

    describe("Polling timeout", () => {
        test("should timeout after configured duration", async () => {
            const config: DecoupledTanConfig = {
                totalTimeout: 100, // Very short timeout
                waitBeforeFirstStatusRequest: 50,
            };

            const manager = new DecoupledTanManager("ref123", "Please confirm", mockDialog, config);

            // Mock the connection to never respond
            mockDialog.connection.send = jest.fn().mockImplementation(() => {
                return new Promise(() => {}); // Never resolves
            });

            await expect(manager.pollForConfirmation()).rejects.toThrow(DecoupledTanError);
            await expect(manager.pollForConfirmation()).rejects.toThrow(/timed out/i);

            const status = manager.getStatus();
            expect(status.state).toBe(DecoupledTanState.TIMED_OUT);
        }, 10000);

        test("should clear timeout on successful confirmation", async () => {
            const config: DecoupledTanConfig = {
                totalTimeout: 10000,
                waitBeforeFirstStatusRequest: 10,
                waitBetweenStatusRequests: 10,
            };

            const manager = new DecoupledTanManager("ref123", "Please confirm", mockDialog, config);

            // Mock successful response
            const mockResponse = {
                returnValues: jest.fn().mockReturnValue(new Map([["0030", { code: "0030", message: "Success" }]])),
            } as unknown as Response;

            mockDialog.connection.send = jest.fn().mockResolvedValue(mockResponse);

            const result = await manager.pollForConfirmation();

            expect(result).toBe(mockResponse);
            expect(manager.getStatus().state).toBe(DecoupledTanState.CONFIRMED);
        }, 10000);
    });

    describe("Status callback", () => {
        test("should call callback on state changes", async () => {
            const config: DecoupledTanConfig = {
                waitBeforeFirstStatusRequest: 10,
                waitBetweenStatusRequests: 10,
            };

            const manager = new DecoupledTanManager("ref123", "Please confirm", mockDialog, config);

            const states: DecoupledTanState[] = [];
            const callback = jest.fn((status) => {
                states.push(status.state);
            });

            // Mock successful response
            const mockResponse = {
                returnValues: jest.fn().mockReturnValue(new Map([["0030", { code: "0030", message: "Success" }]])),
            } as unknown as Response;

            mockDialog.connection.send = jest.fn().mockResolvedValue(mockResponse);

            await manager.pollForConfirmation(callback);

            expect(callback).toHaveBeenCalled();
            expect(states).toContain(DecoupledTanState.CHALLENGE_SENT);
            expect(states).toContain(DecoupledTanState.PENDING_CONFIRMATION);
            expect(states).toContain(DecoupledTanState.CONFIRMED);
        }, 10000);
    });

    describe("Error handling", () => {
        test("should throw DecoupledTanError on cancellation during polling", async () => {
            const config: DecoupledTanConfig = {
                waitBeforeFirstStatusRequest: 50,
            };

            const manager = new DecoupledTanManager("ref123", "Please confirm", mockDialog, config);

            // Mock pending response
            const mockResponse = {
                returnValues: jest.fn().mockReturnValue(new Map([["3956", { code: "3956", message: "Pending" }]])),
                success: true,
            } as unknown as Response;

            mockDialog.connection.send = jest.fn().mockResolvedValue(mockResponse);

            // Start polling and cancel shortly after
            const pollPromise = manager.pollForConfirmation();
            setTimeout(() => manager.cancel(), 100);

            await expect(pollPromise).rejects.toThrow(DecoupledTanError);
            await expect(pollPromise).rejects.toThrow(/cancelled/i);
        }, 10000);

        test("should throw DecoupledTanError on max status requests exceeded", async () => {
            const config: DecoupledTanConfig = {
                maxStatusRequests: 2,
                waitBeforeFirstStatusRequest: 10,
                waitBetweenStatusRequests: 10,
                totalTimeout: 10000,
            };

            const manager = new DecoupledTanManager("ref123", "Please confirm", mockDialog, config);

            // Mock pending response (never confirms)
            const mockResponse = {
                returnValues: jest.fn().mockReturnValue(new Map([["3956", { code: "3956", message: "Pending" }]])),
                success: true,
            } as unknown as Response;

            mockDialog.connection.send = jest.fn().mockResolvedValue(mockResponse);

            await expect(manager.pollForConfirmation()).rejects.toThrow(DecoupledTanError);
            await expect(manager.pollForConfirmation()).rejects.toThrow(/Maximum status requests exceeded/i);

            const status = manager.getStatus();
            expect(status.state).toBe(DecoupledTanState.FAILED);
            expect(status.statusRequestCount).toBe(2);
        }, 10000);
    });

    describe("Response handling", () => {
        test("should recognize confirmation (0030 without 3956)", async () => {
            const config: DecoupledTanConfig = {
                waitBeforeFirstStatusRequest: 10,
            };

            const manager = new DecoupledTanManager("ref123", "Please confirm", mockDialog, config);

            const mockResponse = {
                returnValues: jest.fn().mockReturnValue(new Map([["0030", { code: "0030", message: "Success" }]])),
            } as unknown as Response;

            mockDialog.connection.send = jest.fn().mockResolvedValue(mockResponse);

            const result = await manager.pollForConfirmation();

            expect(result).toBe(mockResponse);
            expect(manager.getStatus().state).toBe(DecoupledTanState.CONFIRMED);
        }, 10000);

        test("should continue polling on pending status (3956)", async () => {
            const config: DecoupledTanConfig = {
                waitBeforeFirstStatusRequest: 10,
                waitBetweenStatusRequests: 10,
            };

            const manager = new DecoupledTanManager("ref123", "Please confirm", mockDialog, config);

            let callCount = 0;
            const mockPendingResponse = {
                returnValues: jest.fn().mockReturnValue(new Map([["3956", { code: "3956", message: "Pending" }]])),
                success: true,
            } as unknown as Response;

            const mockSuccessResponse = {
                returnValues: jest.fn().mockReturnValue(new Map([["0030", { code: "0030", message: "Success" }]])),
            } as unknown as Response;

            mockDialog.connection.send = jest.fn().mockImplementation(() => {
                callCount++;
                return Promise.resolve(callCount < 3 ? mockPendingResponse : mockSuccessResponse);
            });

            const result = await manager.pollForConfirmation();

            expect(result).toBe(mockSuccessResponse);
            expect(callCount).toBeGreaterThanOrEqual(3);
            expect(manager.getStatus().statusRequestCount).toBe(3);
        }, 10000);

        test("should handle server errors", async () => {
            const config: DecoupledTanConfig = {
                waitBeforeFirstStatusRequest: 10,
            };

            const manager = new DecoupledTanManager("ref123", "Please confirm", mockDialog, config);

            const mockResponse = {
                returnValues: jest.fn().mockReturnValue(new Map()),
                success: false,
                errors: ["Server error occurred"],
            } as unknown as Response;

            mockDialog.connection.send = jest.fn().mockResolvedValue(mockResponse);

            await expect(manager.pollForConfirmation()).rejects.toThrow(DecoupledTanError);
            await expect(manager.pollForConfirmation()).rejects.toThrow(/Server error/i);

            expect(manager.getStatus().state).toBe(DecoupledTanState.FAILED);
        }, 10000);
    });
});
