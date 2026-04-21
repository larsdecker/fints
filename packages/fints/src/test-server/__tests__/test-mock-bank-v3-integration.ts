/**
 * Integration tests for FinTS 3.0 using the Mock Bank Server.
 *
 * These tests exercise the complete client ↔ server interaction
 * through a simulated bank server that returns realistic test data.
 * Covers all major FinTS 3.0 business transactions.
 */
import { Dialog, DialogConfig } from "../../dialog";
import { MockBankServerV3 } from "../mock-bank-server";
import { TEST_BANK_V3, TEST_ACCOUNTS_V3 } from "../test-data";
import {
    HKSPA,
    HISPA,
    HKSAL,
    HISAL,
    HKKAZ,
    HIKAZ,
    HKCCS,
    HICCS,
    HKDSE,
    HIDSE,
    HKCSE,
    HICSE,
    HKCDB,
    HKWPD,
    HIWPD,
    HKPAE,
} from "../../segments";
import { Request } from "../../request";
import { PinTanClient } from "../../pin-tan-client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(): DialogConfig {
    const config = new DialogConfig();
    config.blz = TEST_BANK_V3.blz;
    config.name = "testuser";
    config.pin = "12345";
    config.systemId = "0";
    return config;
}

function makeAccount() {
    const acc = TEST_ACCOUNTS_V3[0];
    return {
        iban: acc.iban,
        bic: acc.bic,
        accountNumber: acc.accountNumber,
        blz: acc.blz,
        subAccount: "",
    };
}

function makePain001Xml(): string {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    return (
        `<?xml version="1.0" encoding="UTF-8"?>` +
        `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.003.03">` +
        `<CstmrCdtTrfInitn><GrpHdr>` +
        `<MsgId>CT-TEST-001</MsgId>` +
        `<CreDtTm>${dateStr}T00:00:00</CreDtTm>` +
        `<NbOfTxs>1</NbOfTxs><CtrlSum>100.00</CtrlSum>` +
        `<InitgPty><Nm>Max Mustermann</Nm></InitgPty>` +
        `</GrpHdr><PmtInf>` +
        `<PmtInfId>PII-001</PmtInfId><PmtMtd>TRF</PmtMtd>` +
        `<NbOfTxs>1</NbOfTxs><CtrlSum>100.00</CtrlSum>` +
        `<PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>` +
        `<ReqdExctnDt>${tomorrowStr}</ReqdExctnDt>` +
        `<Dbtr><Nm>Max Mustermann</Nm></Dbtr>` +
        `<DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>` +
        `<DbtrAgt><FinInstnId><BIC>SSKNDE77XXX</BIC></FinInstnId></DbtrAgt>` +
        `<ChrgBr>SLEV</ChrgBr>` +
        `<CdtTrfTxInf><PmtId><EndToEndId>NOTPROVIDED</EndToEndId></PmtId>` +
        `<Amt><InstdAmt Ccy="EUR">100.00</InstdAmt></Amt>` +
        `<CdtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></CdtrAgt>` +
        `<Cdtr><Nm>Test Empfaenger</Nm></Cdtr>` +
        `<CdtrAcct><Id><IBAN>DE27100777770209299700</IBAN></Id></CdtrAcct>` +
        `</CdtTrfTxInf></PmtInf>` +
        `</CstmrCdtTrfInitn></Document>`
    );
}

function makePain008Xml(): string {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 3);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    return (
        `<?xml version="1.0" encoding="UTF-8"?>` +
        `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.003.02">` +
        `<CstmrDrctDbtInitn><GrpHdr>` +
        `<MsgId>DD-TEST-001</MsgId>` +
        `<CreDtTm>${dateStr}T00:00:00</CreDtTm>` +
        `<NbOfTxs>1</NbOfTxs><CtrlSum>50.00</CtrlSum>` +
        `<InitgPty><Nm>Max Mustermann</Nm></InitgPty>` +
        `</GrpHdr><PmtInf>` +
        `<PmtInfId>PII-DD-001</PmtInfId><PmtMtd>DD</PmtMtd>` +
        `<NbOfTxs>1</NbOfTxs><CtrlSum>50.00</CtrlSum>` +
        `<PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl>` +
        `<LclInstrm><Cd>CORE</Cd></LclInstrm>` +
        `<SeqTp>OOFF</SeqTp></PmtTpInf>` +
        `<ReqdColltnDt>${tomorrowStr}</ReqdColltnDt>` +
        `<Cdtr><Nm>Max Mustermann</Nm></Cdtr>` +
        `<CdtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></CdtrAcct>` +
        `<CdtrAgt><FinInstnId><BIC>SSKNDE77XXX</BIC></FinInstnId></CdtrAgt>` +
        `<ChrgBr>SLEV</ChrgBr>` +
        `<CdtrSchmeId><Id><PrvtId><Othr>` +
        `<Id>DE98ZZZ09999999999</Id>` +
        `<SchmeNm><Prtry>SEPA</Prtry></SchmeNm>` +
        `</Othr></PrvtId></Id></CdtrSchmeId>` +
        `<DrctDbtTxInf><PmtId><EndToEndId>NOTPROVIDED</EndToEndId></PmtId>` +
        `<InstdAmt Ccy="EUR">50.00</InstdAmt>` +
        `<DrctDbtTx><MndtRltdInf>` +
        `<MndtId>MNDT-001</MndtId>` +
        `<DtOfSgntr>2020-01-01</DtOfSgntr>` +
        `</MndtRltdInf></DrctDbtTx>` +
        `<Dbtr><Nm>Test Schuldner</Nm></Dbtr>` +
        `<DbtrAcct><Id><IBAN>DE27100777770209299700</IBAN></Id></DbtrAcct>` +
        `</DrctDbtTxInf></PmtInf>` +
        `</CstmrDrctDbtInitn></Document>`
    );
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("FinTS 3.0 Integration: Mock Bank Server", () => {
    let server: MockBankServerV3;
    let dialog: Dialog;

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

        it("detects HICCSS support (credit transfer)", async () => {
            await dialog.sync();
            expect(dialog.supportsCreditTransfer).toBe(true);
        });

        it("detects HIDSES support (direct debit)", async () => {
            await dialog.sync();
            expect(dialog.supportsDirectDebit).toBe(true);
        });

        it("detects HICSES support (scheduled credit transfer)", async () => {
            await dialog.sync();
            expect(dialog.supportsScheduledCreditTransfer).toBe(true);
        });

        it("detects HICDBS support (standing orders)", async () => {
            await dialog.sync();
            expect(dialog.supportsStandingOrders).toBe(true);
        });

        it("detects HIWPDS support (holdings)", async () => {
            await dialog.sync();
            expect(dialog.hiwpdsVersion).toBeGreaterThan(0);
        });

        it("reports all capabilities correctly", async () => {
            await dialog.sync();
            const caps = dialog.capabilities;
            expect(caps.supportsAccounts).toBe(true);
            expect(caps.supportsBalance).toBe(true);
            expect(caps.supportsTransactions).toBe(true);
            expect(caps.supportsHoldings).toBe(true);
            expect(caps.supportsStandingOrders).toBe(true);
            expect(caps.supportsCreditTransfer).toBe(true);
            expect(caps.supportsDirectDebit).toBe(true);
            expect(caps.supportsScheduledCreditTransfer).toBe(true);
        });

        it("receives all three advertised PAIN formats from HISPAS", async () => {
            await dialog.sync();
            expect(dialog.painFormats).toContain("urn:iso:std:iso:20022:tech:xsd:pain.001.003.03");
            expect(dialog.painFormats).toContain("urn:iso:std:iso:20022:tech:xsd:pain.008.003.02");
            expect(dialog.painFormats.length).toBeGreaterThanOrEqual(3);
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

        it("returns multiple accounts", async () => {
            await dialog.sync();
            await dialog.init();

            const { blz, name, pin, systemId, dialogId, msgNo } = dialog;
            const segments = [new HKSPA({ segNo: 3 })];
            const request = new Request({ blz, name, pin, systemId, dialogId, msgNo, segments });
            const response = await dialog.send(request);

            const hispaSegments = response.findSegments(HISPA);
            expect(hispaSegments.length).toBeGreaterThan(0);
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

            const { blz, name, pin, systemId, dialogId, msgNo } = dialog;
            const segments = [
                new HKSAL({
                    segNo: 3,
                    version: dialog.hisalsVersion,
                    account: makeAccount(),
                }),
            ];
            const request = new Request({ blz, name, pin, systemId, dialogId, msgNo, segments });
            const response = await dialog.send(request);

            expect(response.success).toBe(true);
            await dialog.end();
        });

        it("response includes HISAL segment with balance data", async () => {
            await dialog.sync();
            await dialog.init();

            const { blz, name, pin, systemId, dialogId, msgNo } = dialog;
            const segments = [
                new HKSAL({
                    segNo: 3,
                    version: dialog.hisalsVersion,
                    account: makeAccount(),
                }),
            ];
            const request = new Request({ blz, name, pin, systemId, dialogId, msgNo, segments });
            const response = await dialog.send(request);

            const hisal = response.findSegment(HISAL);
            expect(hisal).toBeDefined();
            expect(hisal.bookedBalance).toBeGreaterThan(0);
            expect(hisal.currency).toBe("EUR");
            await dialog.end();
        });
    });

    // -----------------------------------------------------------------------
    // Account Statements (HKKAZ → HIKAZ)
    // -----------------------------------------------------------------------

    describe("Account Statements", () => {
        it("retrieves MT940 statement data via HKKAZ", async () => {
            await dialog.sync();
            await dialog.init();

            const { blz, name, pin, systemId, dialogId, msgNo } = dialog;
            const segments = [
                new HKKAZ({
                    segNo: 3,
                    version: dialog.hikazsVersion,
                    account: makeAccount(),
                    startDate: new Date("2024-01-01"),
                    endDate: new Date("2024-12-31"),
                }),
            ];
            const request = new Request({ blz, name, pin, systemId, dialogId, msgNo, segments });
            const response = await dialog.send(request);

            expect(response.success).toBe(true);
            await dialog.end();
        });

        it("response contains HIKAZ segment with MT940 data", async () => {
            await dialog.sync();
            await dialog.init();

            const { blz, name, pin, systemId, dialogId, msgNo } = dialog;
            const segments = [
                new HKKAZ({
                    segNo: 3,
                    version: dialog.hikazsVersion,
                    account: makeAccount(),
                    startDate: new Date("2024-01-01"),
                    endDate: new Date("2024-12-31"),
                }),
            ];
            const request = new Request({ blz, name, pin, systemId, dialogId, msgNo, segments });
            const response = await dialog.send(request);

            const hikaz = response.findSegment(HIKAZ);
            expect(hikaz).toBeDefined();
            expect(hikaz.bookedTransactions).toContain(":20:STARTUMS");
            await dialog.end();
        });
    });

    // -----------------------------------------------------------------------
    // SEPA Credit Transfer (HKCCS → HICCS)
    // -----------------------------------------------------------------------

    describe("SEPA Credit Transfer", () => {
        it("submits a credit transfer via HKCCS and receives HICCS", async () => {
            await dialog.sync();
            await dialog.init();

            const { blz, name, pin, systemId, dialogId, msgNo } = dialog;
            const painXml = makePain001Xml();
            const segments = [
                new HKCCS({
                    segNo: 3,
                    version: dialog.hkccsVersion || 1,
                    account: makeAccount(),
                    painDescriptor: "urn:iso:std:iso:20022:tech:xsd:pain.001.003.03",
                    painMessage: painXml,
                }),
            ];
            const request = new Request({ blz, name, pin, systemId, dialogId, msgNo, segments });
            const response = await dialog.send(request);

            expect(response.success).toBe(true);
            await dialog.end();
        });

        it("response includes HICCS acknowledgement with task ID", async () => {
            await dialog.sync();
            await dialog.init();

            const { blz, name, pin, systemId, dialogId, msgNo } = dialog;
            const painXml = makePain001Xml();
            const segments = [
                new HKCCS({
                    segNo: 3,
                    version: dialog.hkccsVersion || 1,
                    account: makeAccount(),
                    painDescriptor: "urn:iso:std:iso:20022:tech:xsd:pain.001.003.03",
                    painMessage: painXml,
                }),
            ];
            const request = new Request({ blz, name, pin, systemId, dialogId, msgNo, segments });
            const response = await dialog.send(request);

            const hiccs = response.findSegment(HICCS);
            expect(hiccs).toBeDefined();
            expect(hiccs.taskId).toBeDefined();
            await dialog.end();
        });
    });

    // -----------------------------------------------------------------------
    // SEPA Direct Debit (HKDSE → HIDSE)
    // -----------------------------------------------------------------------

    describe("SEPA Direct Debit", () => {
        it("submits a direct debit via HKDSE and receives HIDSE", async () => {
            await dialog.sync();
            await dialog.init();

            const { blz, name, pin, systemId, dialogId, msgNo } = dialog;
            const painXml = makePain008Xml();
            const segments = [
                new HKDSE({
                    segNo: 3,
                    version: dialog.hkdseVersion || 1,
                    account: makeAccount(),
                    painDescriptor: "urn:iso:std:iso:20022:tech:xsd:pain.008.003.02",
                    painMessage: painXml,
                }),
            ];
            const request = new Request({ blz, name, pin, systemId, dialogId, msgNo, segments });
            const response = await dialog.send(request);

            expect(response.success).toBe(true);
            await dialog.end();
        });

        it("response includes HIDSE acknowledgement with task ID", async () => {
            await dialog.sync();
            await dialog.init();

            const { blz, name, pin, systemId, dialogId, msgNo } = dialog;
            const painXml = makePain008Xml();
            const segments = [
                new HKDSE({
                    segNo: 3,
                    version: dialog.hkdseVersion || 1,
                    account: makeAccount(),
                    painDescriptor: "urn:iso:std:iso:20022:tech:xsd:pain.008.003.02",
                    painMessage: painXml,
                }),
            ];
            const request = new Request({ blz, name, pin, systemId, dialogId, msgNo, segments });
            const response = await dialog.send(request);

            const hidse = response.findSegment(HIDSE);
            expect(hidse).toBeDefined();
            expect(hidse.taskId).toBeDefined();
            await dialog.end();
        });
    });

    // -----------------------------------------------------------------------
    // Scheduled Credit Transfer (HKCSE → HICSE)
    // -----------------------------------------------------------------------

    describe("Scheduled Credit Transfer (Terminüberweisung)", () => {
        it("submits a scheduled credit transfer via HKCSE", async () => {
            await dialog.sync();
            await dialog.init();

            const { blz, name, pin, systemId, dialogId, msgNo } = dialog;
            const painXml = makePain001Xml();
            const segments = [
                new HKCSE({
                    segNo: 3,
                    version: dialog.hkcseVersion || 1,
                    account: makeAccount(),
                    painDescriptor: "urn:iso:std:iso:20022:tech:xsd:pain.001.003.03",
                    painMessage: painXml,
                }),
            ];
            const request = new Request({ blz, name, pin, systemId, dialogId, msgNo, segments });
            const response = await dialog.send(request);

            expect(response.success).toBe(true);
            await dialog.end();
        });

        it("response includes HICSE acknowledgement with task ID", async () => {
            await dialog.sync();
            await dialog.init();

            const { blz, name, pin, systemId, dialogId, msgNo } = dialog;
            const painXml = makePain001Xml();
            const segments = [
                new HKCSE({
                    segNo: 3,
                    version: dialog.hkcseVersion || 1,
                    account: makeAccount(),
                    painDescriptor: "urn:iso:std:iso:20022:tech:xsd:pain.001.003.03",
                    painMessage: painXml,
                }),
            ];
            const request = new Request({ blz, name, pin, systemId, dialogId, msgNo, segments });
            const response = await dialog.send(request);

            const hicse = response.findSegment(HICSE);
            expect(hicse).toBeDefined();
            expect(hicse.taskId).toBeDefined();
            await dialog.end();
        });
    });

    // -----------------------------------------------------------------------
    // Standing Orders (HKCDB → HICDB)
    // -----------------------------------------------------------------------

    describe("Standing Orders", () => {
        it("retrieves standing orders via HKCDB", async () => {
            await dialog.sync();
            await dialog.init();

            const { blz, name, pin, systemId, dialogId, msgNo } = dialog;
            const segments = [
                new HKCDB({
                    segNo: 3,
                    version: dialog.hicdbVersion || 1,
                    account: makeAccount(),
                    painFormats: dialog.painFormats,
                }),
            ];
            const request = new Request({ blz, name, pin, systemId, dialogId, msgNo, segments });
            const response = await dialog.send(request);

            expect(response.success).toBe(true);
            await dialog.end();
        });
    });

    // -----------------------------------------------------------------------
    // Holdings / Securities Portfolio (HKWPD → HIWPD)
    // -----------------------------------------------------------------------

    describe("Holdings / Securities Portfolio", () => {
        it("retrieves holdings via HKWPD", async () => {
            await dialog.sync();
            await dialog.init();

            const { blz, name, pin, systemId, dialogId, msgNo } = dialog;
            const segments = [
                new HKWPD({
                    segNo: 3,
                    version: dialog.hiwpdsVersion || 1,
                    account: makeAccount(),
                }),
            ];
            const request = new Request({ blz, name, pin, systemId, dialogId, msgNo, segments });
            const response = await dialog.send(request);

            expect(response.success).toBe(true);
            await dialog.end();
        });

        it("response contains HIWPD segment with MT535 data", async () => {
            await dialog.sync();
            await dialog.init();

            const { blz, name, pin, systemId, dialogId, msgNo } = dialog;
            const segments = [
                new HKWPD({
                    segNo: 3,
                    version: dialog.hiwpdsVersion || 1,
                    account: makeAccount(),
                }),
            ];
            const request = new Request({ blz, name, pin, systemId, dialogId, msgNo, segments });
            const response = await dialog.send(request);

            const hiwpd = response.findSegment(HIWPD);
            expect(hiwpd).toBeDefined();
            expect(hiwpd.holdings).toContain(":16R:GENL");
            await dialog.end();
        });
    });

    // -----------------------------------------------------------------------
    // PIN Change (HKPAE)
    // -----------------------------------------------------------------------

    describe("PIN Change", () => {
        it("changes PIN via HKPAE", async () => {
            await dialog.sync();
            await dialog.init();

            const { blz, name, pin, systemId, dialogId, msgNo } = dialog;
            const segments = [new HKPAE({ segNo: 3, version: 3, newPin: "99999" })];
            const request = new Request({ blz, name, pin, systemId, dialogId, msgNo, segments });
            const response = await dialog.send(request);

            expect(response.success).toBe(true);
            await dialog.end();
        });

        it("HKPAE serializes new PIN twice", () => {
            const segment = new HKPAE({ segNo: 3, version: 3, newPin: "newpass" });
            const str = segment.toString();
            // should contain the new PIN twice (confirmation)
            expect(str).toBe("HKPAE:3:3+newpass+newpass'");
        });
    });

    // -----------------------------------------------------------------------
    // PinTanClient high-level API
    // -----------------------------------------------------------------------

    describe("PinTanClient high-level API", () => {
        let client: PinTanClient;

        beforeEach(() => {
            server.reset();
            client = new PinTanClient({
                blz: TEST_BANK_V3.blz,
                name: "testuser",
                pin: "12345",
                url: "https://mock.bank.de/fints",
            });
            // Inject the mock server as connection
            (client as any).connection = server;
        });

        it("capabilities() returns all supported features", async () => {
            const caps = await client.capabilities();
            expect(caps.supportsAccounts).toBe(true);
            expect(caps.supportsBalance).toBe(true);
            expect(caps.supportsTransactions).toBe(true);
            expect(caps.supportsCreditTransfer).toBe(true);
            expect(caps.supportsDirectDebit).toBe(true);
            expect(caps.supportsScheduledCreditTransfer).toBe(true);
            expect(caps.supportsStandingOrders).toBe(true);
            expect(caps.supportsHoldings).toBe(true);
        });

        it("accounts() returns list of accounts", async () => {
            const accounts = await client.accounts();
            expect(accounts.length).toBeGreaterThan(0);
            expect(accounts[0].iban).toBeTruthy();
        });

        it("balance() returns account balance", async () => {
            const accounts = await client.accounts();
            const balance = await client.balance(accounts[0]);
            expect(balance).toBeDefined();
            expect(balance.bookedBalance).toBeGreaterThan(0);
            expect(balance.currency).toBe("EUR");
        });

        it("statements() returns parsed MT940 transactions", async () => {
            const accounts = await client.accounts();
            const statements = await client.statements(accounts[0]);
            expect(statements.length).toBeGreaterThan(0);
            expect(statements[0].transactions.length).toBeGreaterThan(0);
        });

        it("changePin() sends HKPAE and succeeds", async () => {
            await expect(client.changePin("newpin99")).resolves.not.toThrow();
        });
    });

    // -----------------------------------------------------------------------
    // PinTanClient – scheduledCreditTransfer high-level API
    // -----------------------------------------------------------------------

    describe("PinTanClient scheduledCreditTransfer()", () => {
        let client: PinTanClient;

        beforeEach(() => {
            server.reset();
            client = new PinTanClient({
                blz: TEST_BANK_V3.blz,
                name: "testuser",
                pin: "12345",
                url: "https://mock.bank.de/fints",
            });
            (client as any).connection = server;
        });

        it("submits a scheduled credit transfer and returns submission with taskId", async () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const account = makeAccount();
            const submission = await client.scheduledCreditTransfer(account, {
                debtorName: "Max Mustermann",
                creditor: {
                    name: "Test Empfaenger",
                    iban: "DE27100777770209299700",
                    bic: "COBADEFFXXX",
                },
                amount: 100,
                currency: "EUR",
                remittanceInformation: "Testüberweisung terminiert",
                executionDate: tomorrow,
            });

            expect(submission).toBeDefined();
            expect(submission.taskId).toBeDefined();
            expect(submission.xml).toContain("<CstmrCdtTrfInitn>");
        });

        it("throws when bank does not support scheduled credit transfers", async () => {
            // Swap to a server that omits the HICSES parameter segment by not exposing
            // that capability. We can simulate this by overriding the dialog after sync.
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);

            const account = makeAccount();

            // Patch the createDialog method to return a dialog that reports the feature as unsupported
            const originalCreateDialog = (client as any).createDialog.bind(client);
            (client as any).createDialog = (...args: any[]): any => {
                const dlg = originalCreateDialog(...args);
                const origSync = dlg.sync.bind(dlg);
                dlg.sync = async (): Promise<void> => {
                    await origSync();
                    dlg.supportsScheduledCreditTransfer = false;
                };
                return dlg;
            };

            await expect(
                client.scheduledCreditTransfer(account, {
                    debtorName: "Max Mustermann",
                    creditor: { name: "Empf", iban: "DE27100777770209299700", bic: "COBADEFFXXX" },
                    amount: 50,
                    executionDate: tomorrow,
                }),
            ).rejects.toThrow("not supported by this bank");
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
