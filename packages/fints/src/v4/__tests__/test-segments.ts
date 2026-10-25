import {
    buildDialogInitSegment,
    buildDialogEndSegment,
    buildSyncSegment,
    buildAccountListSegment,
    buildBalanceSegment,
    buildAccountStatementSegment,
    buildHoldingsSegment,
    buildTanSegment,
} from "../segments";
import { FINTS_VERSION, COUNTRY_CODE } from "../constants";
import { SEPAAccount } from "../../types";

const testAccount: SEPAAccount = {
    iban: "DE89370400440532013000",
    bic: "COBADEFFXXX",
    accountNumber: "0532013000",
    blz: "37040044",
};

describe("v4 segments", () => {
    describe("buildDialogInitSegment", () => {
        it("creates a DialogInit segment with correct type and version", () => {
            const seg = buildDialogInitSegment({
                segNo: 1,
                blz: "12345678",
                name: "testuser",
                systemId: "0",
            });

            expect(seg.type).toBe("DialogInit");
            expect(seg.version).toBe(1);
            expect(seg.segNo).toBe(1);
        });

        it("includes BLZ and country code in body", () => {
            const seg = buildDialogInitSegment({
                segNo: 1,
                blz: "12345678",
                name: "user",
                systemId: "0",
            });

            expect(seg.body).toContain("<BLZ>12345678</BLZ>");
            expect(seg.body).toContain(`<CountryCode>${COUNTRY_CODE}</CountryCode>`);
        });

        it("includes customer ID and system ID", () => {
            const seg = buildDialogInitSegment({
                segNo: 1,
                blz: "12345678",
                name: "myuser",
                systemId: "sys123",
            });

            expect(seg.body).toContain("<CustomerID>myuser</CustomerID>");
            expect(seg.body).toContain("<SystemID>sys123</SystemID>");
        });

        it("includes HBCI version", () => {
            const seg = buildDialogInitSegment({
                segNo: 1,
                blz: "12345678",
                name: "user",
                systemId: "0",
            });

            expect(seg.body).toContain(`<HBCIVersion>${FINTS_VERSION}</HBCIVersion>`);
        });

        it("includes custom product ID", () => {
            const seg = buildDialogInitSegment({
                segNo: 1,
                blz: "12345678",
                name: "user",
                systemId: "0",
                productId: "myApp",
            });

            expect(seg.body).toContain("<Name>myApp</Name>");
        });
    });

    describe("buildDialogEndSegment", () => {
        it("creates a DialogEnd segment", () => {
            const seg = buildDialogEndSegment({
                segNo: 5,
                dialogId: "dialog-abc",
            });

            expect(seg.type).toBe("DialogEnd");
            expect(seg.version).toBe(1);
            expect(seg.segNo).toBe(5);
            expect(seg.body).toContain("<DialogID>dialog-abc</DialogID>");
        });
    });

    describe("buildSyncSegment", () => {
        it("creates a Sync segment with default mode", () => {
            const seg = buildSyncSegment({ segNo: 2 });

            expect(seg.type).toBe("Sync");
            expect(seg.version).toBe(1);
            expect(seg.segNo).toBe(2);
            expect(seg.body).toContain("<SyncMode>0</SyncMode>");
        });

        it("creates a Sync segment with custom mode", () => {
            const seg = buildSyncSegment({ segNo: 2, mode: 1 });
            expect(seg.body).toContain("<SyncMode>1</SyncMode>");
        });
    });

    describe("buildAccountListSegment", () => {
        it("creates an AccountList segment", () => {
            const seg = buildAccountListSegment({ segNo: 3 });

            expect(seg.type).toBe("AccountList");
            expect(seg.version).toBe(1);
            expect(seg.segNo).toBe(3);
            expect(seg.body).toContain("<AllAccounts>true</AllAccounts>");
        });
    });

    describe("buildBalanceSegment", () => {
        it("creates a Balance segment with account info", () => {
            const seg = buildBalanceSegment({
                segNo: 3,
                version: 6,
                account: testAccount,
            });

            expect(seg.type).toBe("Balance");
            expect(seg.version).toBe(6);
            expect(seg.segNo).toBe(3);
            expect(seg.body).toContain("<IBAN>DE89370400440532013000</IBAN>");
            expect(seg.body).toContain("<BIC>COBADEFFXXX</BIC>");
            expect(seg.body).toContain("<AccountNumber>0532013000</AccountNumber>");
            expect(seg.body).toContain("<BLZ>37040044</BLZ>");
        });
    });

    describe("buildAccountStatementSegment", () => {
        it("creates an AccountStatement segment", () => {
            const seg = buildAccountStatementSegment({
                segNo: 3,
                version: 1,
                account: testAccount,
            });

            expect(seg.type).toBe("AccountStatement");
            expect(seg.version).toBe(1);
            expect(seg.body).toContain("<IBAN>DE89370400440532013000</IBAN>");
            expect(seg.body).toContain("urn:iso:std:iso:20022:tech:xsd:camt.053.001.02");
        });

        it("includes date range when specified", () => {
            const seg = buildAccountStatementSegment({
                segNo: 3,
                version: 1,
                account: testAccount,
                startDate: new Date("2024-01-01"),
                endDate: new Date("2024-01-31"),
            });

            expect(seg.body).toContain("<StartDate>2024-01-01</StartDate>");
            expect(seg.body).toContain("<EndDate>2024-01-31</EndDate>");
        });

        it("includes custom camt format", () => {
            const seg = buildAccountStatementSegment({
                segNo: 3,
                version: 1,
                account: testAccount,
                camtFormat: "urn:iso:std:iso:20022:tech:xsd:camt.052.001.02",
            });

            expect(seg.body).toContain("camt.052.001.02");
        });

        it("includes touchdown token for pagination", () => {
            const seg = buildAccountStatementSegment({
                segNo: 3,
                version: 1,
                account: testAccount,
                touchdown: "touch-token-123",
            });

            expect(seg.body).toContain("<Touchdown>touch-token-123</Touchdown>");
        });

        it("omits dates when not specified", () => {
            const seg = buildAccountStatementSegment({
                segNo: 3,
                version: 1,
                account: testAccount,
            });

            expect(seg.body).not.toContain("<StartDate>");
            expect(seg.body).not.toContain("<EndDate>");
        });
    });

    describe("buildTanSegment", () => {
        it("creates a TAN segment with process", () => {
            const seg = buildTanSegment({
                segNo: 4,
                version: 1,
                process: "4",
            });

            expect(seg.type).toBe("TAN");
            expect(seg.version).toBe(1);
            expect(seg.body).toContain("<TANProcess>4</TANProcess>");
        });

        it("includes segment reference", () => {
            const seg = buildTanSegment({
                segNo: 4,
                version: 1,
                process: "4",
                segmentReference: "AccountStatement",
            });

            expect(seg.body).toContain("<SegmentReference>AccountStatement</SegmentReference>");
        });

        it("includes TAN medium", () => {
            const seg = buildTanSegment({
                segNo: 4,
                version: 1,
                process: "4",
                medium: "pushTAN",
            });

            expect(seg.body).toContain("<TANMedium>pushTAN</TANMedium>");
        });

        it("includes transaction reference", () => {
            const seg = buildTanSegment({
                segNo: 4,
                version: 1,
                process: "2",
                aref: "txref-123",
            });

            expect(seg.body).toContain("<TransactionReference>txref-123</TransactionReference>");
        });

        it("omits optional fields when not provided", () => {
            const seg = buildTanSegment({
                segNo: 4,
                version: 1,
                process: "4",
            });

            expect(seg.body).not.toContain("<SegmentReference>");
            expect(seg.body).not.toContain("<TANMedium>");
            expect(seg.body).not.toContain("<TransactionReference>");
        });
    });

    describe("buildHoldingsSegment", () => {
        it("creates a Holdings segment with account info", () => {
            const seg = buildHoldingsSegment({
                segNo: 3,
                version: 6,
                account: testAccount,
            });

            expect(seg.type).toBe("Holdings");
            expect(seg.version).toBe(6);
            expect(seg.segNo).toBe(3);
            expect(seg.body).toContain("<IBAN>DE89370400440532013000</IBAN>");
            expect(seg.body).toContain("<BIC>COBADEFFXXX</BIC>");
            expect(seg.body).toContain("<AccountNumber>0532013000</AccountNumber>");
            expect(seg.body).toContain("<BLZ>37040044</BLZ>");
        });

        it("includes touchdown token for pagination", () => {
            const seg = buildHoldingsSegment({
                segNo: 3,
                version: 6,
                account: testAccount,
                touchdown: "touch-depot-123",
            });

            expect(seg.body).toContain("<Touchdown>touch-depot-123</Touchdown>");
        });

        it("omits touchdown when not specified", () => {
            const seg = buildHoldingsSegment({
                segNo: 3,
                version: 6,
                account: testAccount,
            });

            expect(seg.body).not.toContain("<Touchdown>");
        });
    });
});
