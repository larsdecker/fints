/**
 * Integration tests for FinTS 3.0 using the Mock Bank Server.
 *
 * These tests exercise the complete client ↔ server interaction
 * through a simulated bank server that returns realistic test data.
 */
import { Dialog, DialogConfig } from "../../dialog";
import { MockBankServerV3 } from "../mock-bank-server";
import { TEST_BANK_V3, TEST_ACCOUNTS_V3 } from "../test-data";
import { HKSPA, HKSAL, HKKAZ } from "../../segments";
import { Request } from "../../request";

describe("FinTS 3.0 Integration: Mock Bank Server", () => {
    let server: MockBankServerV3;
    let dialog: Dialog;

    function makeConfig(): DialogConfig {
        const config = new DialogConfig();
        config.blz = TEST_BANK_V3.blz;
        config.name = "testuser";
        config.pin = "12345";
        config.systemId = "0";
        return config;
    }

    beforeEach(() => {
        server = new MockBankServerV3();
        dialog = new Dialog(makeConfig(), server);
    });

    afterEach(() => {
        server.reset();
    });

    // -----------------------------------------------------------------------
    // Authentication
    // -----------------------------------------------------------------------

    describe("Authentication", () => {
        it("rejects unknown users with 9931", async () => {
            const cfg = makeConfig();
            cfg.name = "unknownuser";
            const badDialog = new Dialog(cfg, server);
            await expect(badDialog.sync()).rejects.toThrow(/9931/);
        });

        it("rejects invalid PIN with 9340", async () => {
            const cfg = makeConfig();
            cfg.pin = "wrongpin";
            const badDialog = new Dialog(cfg, server);
            await expect(badDialog.sync()).rejects.toThrow(/9340/);
        });

        it("authenticates valid user", async () => {
            await dialog.sync();
            expect(dialog.systemId).toBeTruthy();
            expect(dialog.systemId).not.toBe("0");
        });
    });

    // -----------------------------------------------------------------------
    // Synchronization
    // -----------------------------------------------------------------------

    describe("Synchronization", () => {
        it("obtains a system ID from the server", async () => {
            await dialog.sync();
            expect(dialog.systemId).toMatch(/^SYS/);
        });

        it("receives TAN methods", async () => {
            await dialog.sync();
            expect(dialog.tanMethods.length).toBeGreaterThan(0);
        });

        it("detects HISALS support (balance)", async () => {
            await dialog.sync();
            expect(dialog.supportsBalance).toBe(true);
        });

        it("detects HIKAZS support (statements)", async () => {
            await dialog.sync();
            expect(dialog.supportsTransactions).toBe(true);
        });
    });

    // -----------------------------------------------------------------------
    // Dialog Lifecycle
    // -----------------------------------------------------------------------

    describe("Dialog Lifecycle", () => {
        it("sync → init → end", async () => {
            await dialog.sync();
            expect(dialog.dialogId).toBe("0"); // sync calls end()

            await dialog.init();
            expect(dialog.dialogId).toMatch(/^DLG-/);

            await dialog.end();
            expect(dialog.dialogId).toBe("0");
            expect(dialog.msgNo).toBe(1);
        });

        it("logs requests and responses", async () => {
            await dialog.sync();
            // sync sends 2 messages: sync + end
            expect(server.requestLog.length).toBe(2);
            expect(server.responseLog.length).toBe(2);
        });
    });

    // -----------------------------------------------------------------------
    // Account List (HKSPA → HISPA)
    // -----------------------------------------------------------------------

    describe("Account List", () => {
        it("retrieves accounts via HKSPA", async () => {
            await dialog.sync();
            await dialog.init();

            const { blz, name, pin, systemId, dialogId, msgNo } = dialog;
            const segments = [new HKSPA({ segNo: 3 })];
            const request = new Request({ blz, name, pin, systemId, dialogId, msgNo, segments });
            const response = await dialog.send(request);

            expect(response.success).toBe(true);
            await dialog.end();
        });
    });

    // -----------------------------------------------------------------------
    // Balance Query (HKSAL → HISAL)
    // -----------------------------------------------------------------------

    describe("Balance Query", () => {
        it("retrieves balance via HKSAL", async () => {
            await dialog.sync();
            await dialog.init();

            const account = TEST_ACCOUNTS_V3[0];
            const { blz, name, pin, systemId, dialogId, msgNo } = dialog;
            const segments = [
                new HKSAL({
                    segNo: 3,
                    version: dialog.hisalsVersion,
                    account: {
                        iban: account.iban,
                        bic: account.bic,
                        accountNumber: account.accountNumber,
                        blz: account.blz,
                        subAccount: "",
                    },
                }),
            ];
            const request = new Request({ blz, name, pin, systemId, dialogId, msgNo, segments });
            const response = await dialog.send(request);

            expect(response.success).toBe(true);
            await dialog.end();
        });
    });

    // -----------------------------------------------------------------------
    // Statements (HKKAZ → HIKAZ)
    // -----------------------------------------------------------------------

    describe("Account Statements", () => {
        it("retrieves MT940 statement data via HKKAZ", async () => {
            await dialog.sync();
            await dialog.init();

            const account = TEST_ACCOUNTS_V3[0];
            const { blz, name, pin, systemId, dialogId, msgNo } = dialog;
            const segments = [
                new HKKAZ({
                    segNo: 3,
                    version: dialog.hikazsVersion,
                    account: {
                        iban: account.iban,
                        bic: account.bic,
                        accountNumber: account.accountNumber,
                        blz: account.blz,
                        subAccount: "",
                    },
                    startDate: new Date("2024-01-01"),
                    endDate: new Date("2024-12-31"),
                }),
            ];
            const request = new Request({ blz, name, pin, systemId, dialogId, msgNo, segments });
            const response = await dialog.send(request);

            expect(response.success).toBe(true);
            await dialog.end();
        });
    });

    // -----------------------------------------------------------------------
    // Server State
    // -----------------------------------------------------------------------

    describe("Server State", () => {
        it("reset clears all state", async () => {
            await dialog.sync();
            expect(server.requestLog.length).toBeGreaterThan(0);

            server.reset();
            expect(server.requestLog).toHaveLength(0);
            expect(server.responseLog).toHaveLength(0);
        });
    });
});
