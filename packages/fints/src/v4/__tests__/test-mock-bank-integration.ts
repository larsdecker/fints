/**
 * Integration tests for FinTS 4.1 using the Mock Bank Server.
 *
 * These tests exercise the complete client ↔ server interaction
 * through a simulated bank server that returns realistic test data.
 * Unlike the unit tests, these validate the full request/response cycle
 * including XML serialization, dialog management, security, and parsing.
 */
import { FinTS4Dialog } from "../dialog";
import { MockBankServer } from "../test-server/mock-bank-server";
import { TEST_BANK, TEST_ACCOUNTS, TEST_DEPOT_ACCOUNTS, TEST_TAN_METHODS } from "../test-server/test-data";
import { parseCamt053 } from "../camt-parser";
import {
    buildAccountListSegment,
    buildBalanceSegment,
    buildAccountStatementSegment,
    buildHoldingsSegment,
} from "../segments";

describe("FinTS 4.1 Integration: Mock Bank Server", () => {
    let server: MockBankServer;
    let dialog: FinTS4Dialog;

    beforeEach(() => {
        server = new MockBankServer();
        dialog = new FinTS4Dialog(
            {
                blz: TEST_BANK.blz,
                name: "testuser",
                pin: "12345",
                systemId: "0",
                productId: "integrationTest",
            },
            server.createConnection(),
        );
    });

    afterEach(() => {
        server.reset();
    });

    // -----------------------------------------------------------------------
    // Authentication
    // -----------------------------------------------------------------------

    describe("Authentication", () => {
        it("rejects unknown users with 9931 (Zugang gesperrt)", async () => {
            const badDialog = new FinTS4Dialog(
                {
                    blz: TEST_BANK.blz,
                    name: "unknownuser",
                    pin: "12345",
                    systemId: "0",
                },
                server.createConnection(),
            );

            await expect(badDialog.sync()).rejects.toThrow("9931");
        });

        it("rejects invalid PIN with 9340 (PIN ungültig)", async () => {
            const badDialog = new FinTS4Dialog(
                {
                    blz: TEST_BANK.blz,
                    name: "testuser",
                    pin: "wrongpin",
                    systemId: "0",
                },
                server.createConnection(),
            );

            await expect(badDialog.sync()).rejects.toThrow("9340");
        });

        it("authenticates valid user with correct PIN", async () => {
            await dialog.sync();
            expect(dialog.systemId).toBeTruthy();
            expect(dialog.systemId).not.toBe("0");
        });
    });

    // -----------------------------------------------------------------------
    // Synchronization (§C.1.1)
    // -----------------------------------------------------------------------

    describe("Synchronization", () => {
        it("obtains a unique system ID from the server", async () => {
            await dialog.sync();
            expect(dialog.systemId).toMatch(/^SYS-\d{10}$/);
        });

        it("receives BPD with bank name and version", async () => {
            await dialog.sync();
            expect(dialog.bpd).toBeDefined();
            expect(dialog.bpd!.bankName).toBe(TEST_BANK.bankName);
            expect(dialog.bpd!.bpdVersion).toBe(TEST_BANK.bpdVersion);
        });

        it("receives TAN methods from the server", async () => {
            await dialog.sync();
            expect(dialog.tanMethods).toHaveLength(TEST_TAN_METHODS.length);

            const pushTan = dialog.tanMethods.find((m) => m.name === "pushTAN 2.0");
            expect(pushTan).toBeDefined();
            expect(pushTan!.securityFunction).toBe("912");
            expect(pushTan!.decoupledMaxStatusRequests).toBe(60);

            const chipTan = dialog.tanMethods.find((m) => m.name === "chipTAN QR");
            expect(chipTan).toBeDefined();
            expect(chipTan!.securityFunction).toBe("913");
        });

        it("detects bank capabilities from segment parameters", async () => {
            await dialog.sync();

            expect(dialog.supportsBalance).toBe(true);
            expect(dialog.balanceVersion).toBe(7);
            expect(dialog.supportsStatements).toBe(true);
            expect(dialog.statementVersion).toBe(2);
            expect(dialog.tanVersion).toBe(7);
        });

        it("updates security function to first TAN method", async () => {
            await dialog.sync();
            // Server doesn't offer securityFunction 999
            expect(dialog.securityFunction).toBe("912");
        });

        it("second user can also synchronize independently", async () => {
            const dialog2 = new FinTS4Dialog(
                {
                    blz: TEST_BANK.blz,
                    name: "testuser2",
                    pin: "54321",
                    systemId: "0",
                },
                server.createConnection(),
            );

            await dialog.sync();
            await dialog2.sync();

            // Both get unique system IDs
            expect(dialog.systemId).not.toBe(dialog2.systemId);
            expect(dialog.systemId).toMatch(/^SYS-/);
            expect(dialog2.systemId).toMatch(/^SYS-/);
        });
    });

    // -----------------------------------------------------------------------
    // Full dialog lifecycle (§C.1)
    // -----------------------------------------------------------------------

    describe("Dialog Lifecycle", () => {
        it("sync → init → end: complete workflow", async () => {
            // 1. Synchronize
            await dialog.sync();
            expect(dialog.dialogId).toBe("0"); // sync dialog was ended

            // 2. Initialize new business dialog
            await dialog.init();
            expect(dialog.dialogId).toMatch(/^DLG-/);
            expect(dialog.msgNo).toBe(2); // after init, msgNo incremented

            // 3. End dialog
            await dialog.end();
            expect(dialog.dialogId).toBe("0");
            expect(dialog.msgNo).toBe(1);
        });

        it("logs all request/response pairs", async () => {
            await dialog.sync();

            // sync sends: 1 sync request + 1 dialog end = 2 requests
            expect(server.requestLog.length).toBe(2);
            expect(server.responseLog.length).toBe(2);

            // Request XML should contain FinTSMessage
            expect(server.requestLog[0]).toContain("<FinTSMessage");
            expect(server.requestLog[1]).toContain("DialogEnd");
        });
    });

    // -----------------------------------------------------------------------
    // Account List (§D.1)
    // -----------------------------------------------------------------------

    describe("Account List", () => {
        it("retrieves all test accounts", async () => {
            await dialog.sync();
            await dialog.init();

            const response = await dialog.send([buildAccountListSegment({ segNo: 3 })]);

            expect(response.accounts).toBeDefined();
            expect(response.accounts!.length).toBe(TEST_ACCOUNTS.length);

            const girokonto = response.accounts!.find((a) => a.iban === "DE89370400440532013000");
            expect(girokonto).toBeDefined();
            expect(girokonto!.bic).toBe("SSKNDE77XXX");
            expect(girokonto!.accountOwnerName).toBe("Max Mustermann");

            const sparkonto = response.accounts!.find((a) => a.iban === "DE27100777770209299700");
            expect(sparkonto).toBeDefined();

            await dialog.end();
        });
    });

    // -----------------------------------------------------------------------
    // Balance Query (§D.2)
    // -----------------------------------------------------------------------

    describe("Balance Query", () => {
        it("retrieves balance for a known account", async () => {
            await dialog.sync();
            await dialog.init();

            const response = await dialog.send([
                buildBalanceSegment({
                    segNo: 3,
                    version: dialog.balanceVersion,
                    account: {
                        iban: TEST_ACCOUNTS[0].iban,
                        bic: TEST_ACCOUNTS[0].bic,
                        accountNumber: TEST_ACCOUNTS[0].accountNumber,
                        blz: TEST_ACCOUNTS[0].blz,
                    },
                }),
            ]);

            expect(response.success).toBe(true);
            await dialog.end();
        });

        it("rejects balance for unknown account with 9010", async () => {
            await dialog.sync();
            await dialog.init();

            await expect(
                dialog.send([
                    buildBalanceSegment({
                        segNo: 3,
                        version: 7,
                        account: {
                            iban: "DE00000000000000000000",
                            bic: "UNKNOWN",
                            accountNumber: "0000000000",
                            blz: "00000000",
                        },
                    }),
                ]),
            ).rejects.toThrow("9010");

            // Dialog is still open; end it
            await dialog.end();
        });
    });

    // -----------------------------------------------------------------------
    // Account Statements / camt.053 (§D.3)
    // -----------------------------------------------------------------------

    describe("Account Statements (camt.053)", () => {
        it("retrieves camt.053 data for a known account", async () => {
            await dialog.sync();
            await dialog.init();

            const response = await dialog.send([
                buildAccountStatementSegment({
                    segNo: 3,
                    version: dialog.statementVersion,
                    account: {
                        iban: TEST_ACCOUNTS[0].iban,
                        bic: TEST_ACCOUNTS[0].bic,
                        accountNumber: TEST_ACCOUNTS[0].accountNumber,
                        blz: TEST_ACCOUNTS[0].blz,
                    },
                }),
            ]);

            expect(response.camtData).toBeDefined();
            expect(response.camtData!.length).toBeGreaterThan(0);

            await dialog.end();
        });

        it("camt.053 data can be parsed into structured statements", async () => {
            await dialog.sync();
            await dialog.init();

            const response = await dialog.send([
                buildAccountStatementSegment({
                    segNo: 3,
                    version: dialog.statementVersion,
                    account: {
                        iban: TEST_ACCOUNTS[0].iban,
                        bic: TEST_ACCOUNTS[0].bic,
                        accountNumber: TEST_ACCOUNTS[0].accountNumber,
                        blz: TEST_ACCOUNTS[0].blz,
                    },
                }),
            ]);

            const statements = parseCamt053(response.camtData!);
            expect(statements).toHaveLength(1);

            const stmt = statements[0];
            expect(stmt.iban).toBe(TEST_ACCOUNTS[0].iban);
            expect(stmt.openingBalance).toBe(12345.67);
            expect(stmt.closingBalance).toBe(13095.67);
            expect(stmt.currency).toBe("EUR");
            expect(stmt.entries.length).toBe(5);

            await dialog.end();
        });

        it("camt.053 contains realistic German transaction data", async () => {
            await dialog.sync();
            await dialog.init();

            const response = await dialog.send([
                buildAccountStatementSegment({
                    segNo: 3,
                    version: dialog.statementVersion,
                    account: {
                        iban: TEST_ACCOUNTS[0].iban,
                        bic: TEST_ACCOUNTS[0].bic,
                        accountNumber: TEST_ACCOUNTS[0].accountNumber,
                        blz: TEST_ACCOUNTS[0].blz,
                    },
                }),
            ]);

            const statements = parseCamt053(response.camtData!);
            const entries = statements[0].entries;

            // Salary (credit)
            const salary = entries.find((e) => e.entryReference === "ENT-001");
            expect(salary).toBeDefined();
            expect(salary!.amount).toBe(2500.0);
            expect(salary!.creditDebitIndicator).toBe("CRDT");
            expect(salary!.counterpartyName).toBe("Arbeitgeber Test GmbH");
            expect(salary!.counterpartyIban).toBe("DE44500105175407324931");
            expect(salary!.counterpartyBic).toBe("INGDDEFFXXX");
            expect(salary!.endToEndReference).toContain("GEHALT");
            expect(salary!.mandateReference).toBe("MNDT-GEHALT-001");

            // Rent (debit)
            const rent = entries.find((e) => e.entryReference === "ENT-002");
            expect(rent).toBeDefined();
            expect(rent!.amount).toBe(-850.0);
            expect(rent!.creditDebitIndicator).toBe("DBIT");
            expect(rent!.counterpartyName).toBe("Immobilien Verwaltung GmbH");
            expect(rent!.endToEndReference).toContain("MIETE");
            expect(rent!.remittanceInformation).toContain("Miete");

            // Utility (debit with mandate)
            const utility = entries.find((e) => e.entryReference === "ENT-003");
            expect(utility).toBeDefined();
            expect(utility!.amount).toBe(-45.99);
            expect(utility!.counterpartyName).toBe("Stadtwerke Teststadt");
            expect(utility!.mandateReference).toBe("MNDT-STROM-001");

            // Freelance income (credit)
            const freelance = entries.find((e) => e.entryReference === "ENT-004");
            expect(freelance).toBeDefined();
            expect(freelance!.amount).toBe(1100.0);
            expect(freelance!.counterpartyName).toBe("Consulting Kunde AG");
            expect(freelance!.counterpartyBic).toBe("SOLADEST600");

            // Grocery (debit)
            const grocery = entries.find((e) => e.entryReference === "ENT-005");
            expect(grocery).toBeDefined();
            expect(grocery!.amount).toBe(-54.01);
            expect(grocery!.counterpartyName).toBe("REWE Markt GmbH");
            expect(grocery!.remittanceInformation).toContain("REWE SAGT DANKE");

            await dialog.end();
        });

        it("rejects statement request for unknown account", async () => {
            await dialog.sync();
            await dialog.init();

            await expect(
                dialog.send([
                    buildAccountStatementSegment({
                        segNo: 3,
                        version: 2,
                        account: {
                            iban: "DE00000000000000000000",
                            bic: "UNKNOWN",
                            accountNumber: "0000000000",
                            blz: "00000000",
                        },
                    }),
                ]),
            ).rejects.toThrow("9010");

            await dialog.end();
        });
    });

    // -----------------------------------------------------------------------
    // Server state and logging
    // -----------------------------------------------------------------------

    describe("Server State", () => {
        it("reset clears all state and logs", async () => {
            await dialog.sync();
            expect(server.requestLog.length).toBeGreaterThan(0);

            server.reset();
            expect(server.requestLog).toHaveLength(0);
            expect(server.responseLog).toHaveLength(0);
        });

        it("handles malformed XML gracefully", async () => {
            const conn = server.createConnection();
            const response = await conn.send("this is not xml");
            // Server should return an error response
            expect(response).toContain("FinTSMessage");
        });
    });

    // -----------------------------------------------------------------------
    // Holdings (Depot)
    // -----------------------------------------------------------------------

    describe("Holdings", () => {
        it("fetches holdings for a known account and parses MT535 data", async () => {
            await dialog.sync();
            await dialog.init();

            const response = await dialog.send([
                buildHoldingsSegment({
                    segNo: 3,
                    version: dialog.holdingsVersion,
                    account: {
                        iban: TEST_DEPOT_ACCOUNTS[0].iban,
                        bic: TEST_DEPOT_ACCOUNTS[0].bic,
                        accountNumber: TEST_DEPOT_ACCOUNTS[0].accountNumber,
                        blz: TEST_DEPOT_ACCOUNTS[0].blz,
                    },
                }),
            ]);

            expect(response.mt535Data).toBeDefined();
            expect(response.mt535Data).toContain(":35B:");

            await dialog.end();
        });

        it("rejects holdings request for unknown account", async () => {
            await dialog.sync();
            await dialog.init();

            await expect(
                dialog.send([
                    buildHoldingsSegment({
                        segNo: 3,
                        version: 6,
                        account: {
                            iban: "DE00000000000000000000",
                            bic: "UNKNOWN",
                            accountNumber: "0000000000",
                            blz: "00000000",
                        },
                    }),
                ]),
            ).rejects.toThrow("9010");

            await dialog.end();
        });
    });

    // -----------------------------------------------------------------------
    // Bank Capabilities (end-to-end)
    // -----------------------------------------------------------------------

    describe("Bank Capabilities", () => {
        it("capabilities reflect read-only support after sync", async () => {
            await dialog.sync();

            const caps = dialog.capabilities;
            expect(caps.supportsAccounts).toBe(true);
            expect(caps.supportsBalance).toBe(true);
            expect(caps.supportsTransactions).toBe(true);
            expect(caps.supportsCreditTransfer).toBe(false);
            expect(caps.supportsDirectDebit).toBe(false);
            expect(caps.supportsHoldings).toBe(true);
        });
    });
});
