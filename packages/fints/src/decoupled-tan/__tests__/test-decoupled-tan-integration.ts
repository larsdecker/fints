import { Dialog } from "../../dialog";
import { HttpConnection } from "../../http-connection";
import { DecoupledTanState, DecoupledTanConfig } from "../types";
import { TanRequiredError } from "../../errors/tan-required-error";

describe("Decoupled TAN Integration", () => {
    let mockConnection: HttpConnection;
    let dialog: Dialog;

    beforeEach(() => {
        mockConnection = new HttpConnection({
            url: "https://example.com/fints",
            debug: false,
            timeout: 30000,
            maxRetries: 3,
            retryDelay: 1000,
        });

        const config: DecoupledTanConfig = {
            maxStatusRequests: 10,
            waitBeforeFirstStatusRequest: 10,
            waitBetweenStatusRequests: 10,
            totalTimeout: 10000,
        };

        dialog = new Dialog(
            {
                blz: "12345678",
                name: "testuser",
                pin: "1234",
                systemId: "test-system",
                productId: "fints",
            },
            mockConnection,
            config,
        );
        dialog.hktanVersion = 7;
        dialog.msgNo = 1;
        dialog.dialogId = "test-dialog";
        dialog.tanMethods = [
            {
                securityFunction: "999",
                tanProcess: "2",
                name: "pushTAN",
                decoupledMaxStatusRequests: 60,
                decoupledWaitBeforeFirstStatusRequest: 2000,
                decoupledWaitBetweenStatusRequests: 2000,
            } as any,
        ];
    });

    describe("Dialog.send() decoupled TAN detection", () => {
        test("should detect decoupled TAN requirement with 3956 code", async () => {
            // Mock a proper response object
            const mockResponse = {
                dialogId: "test-dialog",
                success: true,
                returnValues: jest.fn().mockReturnValue(
                    new Map([
                        ["0030", { code: "0030", message: "TAN required" }],
                        ["3956", { code: "3956", message: "Starke Kundenauthentifizierung notwendig" }],
                    ]),
                ),
                findSegment: jest.fn((segmentClass) => {
                    if (segmentClass.name === "HITAN") {
                        return {
                            transactionReference: "ref123",
                            challengeText: "Challenge text",
                            challengeMedia: Buffer.from(""),
                        };
                    }
                    return undefined;
                }),
            } as any;

            mockConnection.send = jest.fn().mockResolvedValue(mockResponse);

            try {
                await dialog.send({
                    msgNo: 1,
                    dialogId: "test-dialog",
                    segments: [],
                } as any);
                throw new Error("Expected TanRequiredError to be thrown");
            } catch (error) {
                if (!(error instanceof TanRequiredError)) {
                    throw error;
                }
                expect(error).toBeInstanceOf(TanRequiredError);
                if (error instanceof TanRequiredError) {
                    expect(error.isDecoupledTan()).toBe(true);
                    expect(error.decoupledTanState).toBe(DecoupledTanState.INITIATED);
                }
            }
        });

        test("should detect decoupled TAN requirement with 3076 code", async () => {
            // Mock a proper response object with PSD2 SCA requirement
            const mockResponse = {
                dialogId: "test-dialog",
                success: true,
                returnValues: jest.fn().mockReturnValue(
                    new Map([
                        ["0030", { code: "0030", message: "TAN required" }],
                        ["3076", { code: "3076", message: "Starke Kundenauthentifizierung notwendig" }],
                    ]),
                ),
                findSegment: jest.fn((segmentClass) => {
                    if (segmentClass.name === "HITAN") {
                        return {
                            transactionReference: "ref123",
                            challengeText: "Challenge text",
                            challengeMedia: Buffer.from(""),
                        };
                    }
                    return undefined;
                }),
            } as any;

            mockConnection.send = jest.fn().mockResolvedValue(mockResponse);

            try {
                await dialog.send({
                    msgNo: 1,
                    dialogId: "test-dialog",
                    segments: [],
                } as any);
                throw new Error("Expected TanRequiredError to be thrown");
            } catch (error) {
                if (!(error instanceof TanRequiredError)) {
                    throw error;
                }
                expect(error).toBeInstanceOf(TanRequiredError);
                if (error instanceof TanRequiredError) {
                    expect(error.isDecoupledTan()).toBe(true);
                    expect(error.decoupledTanState).toBe(DecoupledTanState.INITIATED);
                }
            }
        });

        test("should not mark regular TAN as decoupled", async () => {
            // Mock response with regular TAN requirement (no 3956/3076)
            const mockResponse = {
                dialogId: "test-dialog",
                success: true,
                returnValues: jest.fn().mockReturnValue(new Map([["0030", { code: "0030", message: "TAN required" }]])),
                findSegment: jest.fn((segmentClass) => {
                    if (segmentClass.name === "HITAN") {
                        return {
                            transactionReference: "ref123",
                            challengeText: "Challenge text",
                            challengeMedia: Buffer.from(""),
                        };
                    }
                    return undefined;
                }),
            } as any;

            mockConnection.send = jest.fn().mockResolvedValue(mockResponse);

            try {
                await dialog.send({
                    msgNo: 1,
                    dialogId: "test-dialog",
                    segments: [],
                } as any);
                throw new Error("Expected TanRequiredError to be thrown");
            } catch (error) {
                if (!(error instanceof TanRequiredError)) {
                    throw error;
                }
                expect(error).toBeInstanceOf(TanRequiredError);
                if (error instanceof TanRequiredError) {
                    expect(error.isDecoupledTan()).toBe(false);
                    expect(error.decoupledTanState).toBeUndefined();
                }
            }
        });
    });

    describe("Dialog.handleDecoupledTan() full flow", () => {
        test("should successfully poll and complete decoupled TAN", async () => {
            let callCount = 0;

            // Mock responses: first 2 are pending, 3rd is confirmed
            mockConnection.send = jest.fn().mockImplementation(() => {
                callCount++;
                if (callCount < 3) {
                    return Promise.resolve({
                        dialogId: "test-dialog",
                        returnValues: jest
                            .fn()
                            .mockReturnValue(new Map([["3956", { code: "3956", message: "Pending" }]])),
                        success: true,
                    });
                } else {
                    return Promise.resolve({
                        dialogId: "test-dialog",
                        returnValues: jest
                            .fn()
                            .mockReturnValue(new Map([["0030", { code: "0030", message: "Success" }]])),
                        success: true,
                    });
                }
            });

            const states: DecoupledTanState[] = [];
            const statusCallback = jest.fn((status) => {
                states.push(status.state);
            });

            const response = await dialog.handleDecoupledTan("ref123", "Please confirm", statusCallback);

            expect(response).toBeDefined();
            expect(callCount).toBeGreaterThanOrEqual(3);
            expect(statusCallback).toHaveBeenCalled();
            expect(states).toContain(DecoupledTanState.CHALLENGE_SENT);
            expect(states).toContain(DecoupledTanState.PENDING_CONFIRMATION);
            expect(states).toContain(DecoupledTanState.CONFIRMED);
        }, 10000);

        test("should handle cancellation gracefully", async () => {
            // Mock pending response
            mockConnection.send = jest.fn().mockResolvedValue({
                dialogId: "test-dialog",
                returnValues: jest.fn().mockReturnValue(new Map([["3956", { code: "3956", message: "Pending" }]])),
                success: true,
            });

            const pollPromise = dialog.handleDecoupledTan("ref123", "Please confirm");

            // Cancel after a short delay
            setTimeout(() => {
                dialog.cancelDecoupledTan();
            }, 100);

            await expect(pollPromise).rejects.toThrow(/cancelled/i);
        }, 10000);

        test("should track status during polling", async () => {
            // Mock pending response
            mockConnection.send = jest.fn().mockResolvedValue({
                dialogId: "test-dialog",
                returnValues: jest.fn().mockReturnValue(new Map([["3956", { code: "3956", message: "Pending" }]])),
                success: true,
            });

            const pollPromise = dialog.handleDecoupledTan("ref123", "Please confirm");

            // Check status while polling
            await new Promise((resolve) => setTimeout(resolve, 100));
            const status = dialog.checkDecoupledTanStatus();

            expect(status).toBeDefined();
            if (status) {
                expect(status.transactionReference).toBe("ref123");
                expect([DecoupledTanState.CHALLENGE_SENT, DecoupledTanState.PENDING_CONFIRMATION]).toContain(
                    status.state,
                );
            }

            // Cancel to end the test
            dialog.cancelDecoupledTan();
            await expect(pollPromise).rejects.toThrow();
        }, 10000);
    });

    describe("Multi-step decoupled TAN workflow", () => {
        test("should handle complete credit transfer workflow with decoupled TAN", async () => {
            let callCount = 0;
            mockConnection.send = jest.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    // Initial request triggers decoupled TAN
                    return Promise.resolve({
                        dialogId: "test-dialog",
                        success: true,
                        returnValues: jest.fn().mockReturnValue(
                            new Map([
                                ["0030", { code: "0030", message: "TAN required" }],
                                ["3956", { code: "3956", message: "Starke Kundenauthentifizierung notwendig" }],
                            ]),
                        ),
                        findSegment: jest.fn((segmentClass) => {
                            if (segmentClass.name === "HITAN") {
                                return {
                                    transactionReference: "ref123",
                                    challengeText: "Bitte bestätigen Sie die Überweisung in Ihrer Banking-App",
                                    challengeMedia: Buffer.from(""),
                                };
                            }
                            return undefined;
                        }),
                    });
                } else if (callCount < 4) {
                    // Polling: still pending
                    return Promise.resolve({
                        dialogId: "test-dialog",
                        returnValues: jest
                            .fn()
                            .mockReturnValue(new Map([["3956", { code: "3956", message: "Warten auf Bestätigung" }]])),
                        success: true,
                    });
                } else {
                    // Polling: confirmed
                    return Promise.resolve({
                        dialogId: "test-dialog",
                        returnValues: jest
                            .fn()
                            .mockReturnValue(new Map([["0030", { code: "0030", message: "Auftrag erfolgreich" }]])),
                        success: true,
                    });
                }
            });

            // Simulate the initial request
            let tanError: TanRequiredError | undefined;
            try {
                await dialog.send({
                    msgNo: 1,
                    dialogId: "test-dialog",
                    segments: [],
                } as any);
            } catch (error) {
                if (error instanceof TanRequiredError) {
                    tanError = error;
                }
            }

            expect(tanError).toBeDefined();
            expect(tanError?.isDecoupledTan()).toBe(true);

            // Step 2: Handle the decoupled TAN
            if (tanError) {
                const response = await dialog.handleDecoupledTan(tanError.transactionReference, tanError.challengeText);

                expect(response).toBeDefined();
                expect(callCount).toBeGreaterThanOrEqual(4);
            }
        }, 10000);
    });
});
