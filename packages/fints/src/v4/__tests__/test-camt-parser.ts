import { parseCamt053, parseCamt052 } from "../camt-parser";

describe("camt-parser", () => {
    describe("parseCamt053", () => {
        it("returns empty array for empty string", () => {
            expect(parseCamt053("")).toEqual([]);
        });

        it("returns empty array for whitespace-only string", () => {
            expect(parseCamt053("   ")).toEqual([]);
        });

        it("parses a basic camt.053 document with one statement", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
                    <BkToCstmrStmt>
                        <Stmt>
                            <Id>STMT001</Id>
                            <Acct>
                                <Id>
                                    <IBAN>DE89370400440532013000</IBAN>
                                </Id>
                            </Acct>
                            <CreDtTm>2024-01-15T10:00:00</CreDtTm>
                        </Stmt>
                    </BkToCstmrStmt>
                </Document>`;

            const result = parseCamt053(xml);
            expect(result.length).toBe(1);
            expect(result[0].id).toBe("STMT001");
            expect(result[0].iban).toBe("DE89370400440532013000");
            expect(result[0].entries).toEqual([]);
        });

        it("parses credit entries", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
                    <BkToCstmrStmt>
                        <Stmt>
                            <Id>STMT002</Id>
                            <Ntry>
                                <NtryRef>REF001</NtryRef>
                                <Amt Ccy="EUR">150.00</Amt>
                                <CdtDbtInd>CRDT</CdtDbtInd>
                                <BookgDt>
                                    <Dt>2024-01-10</Dt>
                                </BookgDt>
                                <ValDt>
                                    <Dt>2024-01-10</Dt>
                                </ValDt>
                                <NtryDtls>
                                    <TxDtls>
                                        <RmtInf>
                                            <Ustrd>Payment for invoice 123</Ustrd>
                                        </RmtInf>
                                        <RltdPties>
                                            <Dbtr>
                                                <Nm>Max Mustermann</Nm>
                                            </Dbtr>
                                            <DbtrAcct>
                                                <Id>
                                                    <IBAN>DE27100777770209299700</IBAN>
                                                </Id>
                                            </DbtrAcct>
                                        </RltdPties>
                                        <Refs>
                                            <EndToEndId>E2E-REF-001</EndToEndId>
                                        </Refs>
                                    </TxDtls>
                                </NtryDtls>
                            </Ntry>
                        </Stmt>
                    </BkToCstmrStmt>
                </Document>`;

            const result = parseCamt053(xml);
            expect(result.length).toBe(1);

            const entries = result[0].entries;
            expect(entries.length).toBe(1);
            expect(entries[0].entryReference).toBe("REF001");
            expect(entries[0].amount).toBe(150.0);
            expect(entries[0].currency).toBe("EUR");
            expect(entries[0].creditDebitIndicator).toBe("CRDT");
            expect(entries[0].bookingDate).toEqual(new Date("2024-01-10"));
            expect(entries[0].valueDate).toEqual(new Date("2024-01-10"));
            expect(entries[0].remittanceInformation).toBe("Payment for invoice 123");
            expect(entries[0].counterpartyName).toBe("Max Mustermann");
            expect(entries[0].counterpartyIban).toBe("DE27100777770209299700");
            expect(entries[0].endToEndReference).toBe("E2E-REF-001");
        });

        it("parses debit entries with negative amount", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <Document>
                    <BkToCstmrStmt>
                        <Stmt>
                            <Id>STMT003</Id>
                            <Ntry>
                                <Amt Ccy="EUR">75.50</Amt>
                                <CdtDbtInd>DBIT</CdtDbtInd>
                                <NtryDtls>
                                    <TxDtls>
                                        <RltdPties>
                                            <Cdtr>
                                                <Nm>Online Shop GmbH</Nm>
                                            </Cdtr>
                                            <CdtrAcct>
                                                <Id>
                                                    <IBAN>DE44500105175407324931</IBAN>
                                                </Id>
                                            </CdtrAcct>
                                        </RltdPties>
                                    </TxDtls>
                                </NtryDtls>
                            </Ntry>
                        </Stmt>
                    </BkToCstmrStmt>
                </Document>`;

            const result = parseCamt053(xml);
            const entry = result[0].entries[0];
            expect(entry.amount).toBe(-75.5);
            expect(entry.creditDebitIndicator).toBe("DBIT");
            expect(entry.counterpartyName).toBe("Online Shop GmbH");
            expect(entry.counterpartyIban).toBe("DE44500105175407324931");
        });

        it("parses balance information", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <Document>
                    <BkToCstmrStmt>
                        <Stmt>
                            <Id>STMT004</Id>
                            <Bal>
                                <Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp>
                                <Amt Ccy="EUR">1000.00</Amt>
                                <CdtDbtInd>CRDT</CdtDbtInd>
                            </Bal>
                            <Bal>
                                <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
                                <Amt Ccy="EUR">1150.00</Amt>
                                <CdtDbtInd>CRDT</CdtDbtInd>
                            </Bal>
                        </Stmt>
                    </BkToCstmrStmt>
                </Document>`;

            const result = parseCamt053(xml);
            expect(result[0].openingBalance).toBe(1000.0);
            expect(result[0].closingBalance).toBe(1150.0);
            expect(result[0].currency).toBe("EUR");
        });

        it("parses debit balance correctly", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <Document>
                    <BkToCstmrStmt>
                        <Stmt>
                            <Id>STMT005</Id>
                            <Bal>
                                <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
                                <Amt Ccy="EUR">500.00</Amt>
                                <CdtDbtInd>DBIT</CdtDbtInd>
                            </Bal>
                        </Stmt>
                    </BkToCstmrStmt>
                </Document>`;

            const result = parseCamt053(xml);
            expect(result[0].closingBalance).toBe(-500.0);
        });

        it("parses multiple entries", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <Document>
                    <BkToCstmrStmt>
                        <Stmt>
                            <Id>STMT006</Id>
                            <Ntry>
                                <Amt Ccy="EUR">100.00</Amt>
                                <CdtDbtInd>CRDT</CdtDbtInd>
                            </Ntry>
                            <Ntry>
                                <Amt Ccy="EUR">50.00</Amt>
                                <CdtDbtInd>DBIT</CdtDbtInd>
                            </Ntry>
                            <Ntry>
                                <Amt Ccy="EUR">200.00</Amt>
                                <CdtDbtInd>CRDT</CdtDbtInd>
                            </Ntry>
                        </Stmt>
                    </BkToCstmrStmt>
                </Document>`;

            const result = parseCamt053(xml);
            expect(result[0].entries.length).toBe(3);
            expect(result[0].entries[0].amount).toBe(100.0);
            expect(result[0].entries[1].amount).toBe(-50.0);
            expect(result[0].entries[2].amount).toBe(200.0);
        });

        it("parses bank transaction codes", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <Document>
                    <BkToCstmrStmt>
                        <Stmt>
                            <Id>STMT007</Id>
                            <Ntry>
                                <Amt Ccy="EUR">100.00</Amt>
                                <CdtDbtInd>CRDT</CdtDbtInd>
                                <BkTxCd>
                                    <Domn>
                                        <Cd>PMNT</Cd>
                                    </Domn>
                                </BkTxCd>
                            </Ntry>
                        </Stmt>
                    </BkToCstmrStmt>
                </Document>`;

            const result = parseCamt053(xml);
            expect(result[0].entries[0].bankTransactionCode).toBe("PMNT");
        });

        it("handles entry without transaction details", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <Document>
                    <BkToCstmrStmt>
                        <Stmt>
                            <Id>STMT008</Id>
                            <Ntry>
                                <Amt Ccy="EUR">42.00</Amt>
                                <CdtDbtInd>CRDT</CdtDbtInd>
                            </Ntry>
                        </Stmt>
                    </BkToCstmrStmt>
                </Document>`;

            const result = parseCamt053(xml);
            const entry = result[0].entries[0];
            expect(entry.amount).toBe(42.0);
            expect(entry.counterpartyName).toBeUndefined();
            expect(entry.remittanceInformation).toBeUndefined();
        });

        it("parses mandate reference", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <Document>
                    <BkToCstmrStmt>
                        <Stmt>
                            <Id>STMT009</Id>
                            <Ntry>
                                <Amt Ccy="EUR">29.99</Amt>
                                <CdtDbtInd>DBIT</CdtDbtInd>
                                <NtryDtls>
                                    <TxDtls>
                                        <Refs>
                                            <MndtId>MNDT-2024-001</MndtId>
                                        </Refs>
                                    </TxDtls>
                                </NtryDtls>
                            </Ntry>
                        </Stmt>
                    </BkToCstmrStmt>
                </Document>`;

            const result = parseCamt053(xml);
            expect(result[0].entries[0].mandateReference).toBe("MNDT-2024-001");
        });

        it("parses multiple statements", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <Document>
                    <BkToCstmrStmt>
                        <Stmt>
                            <Id>STMT-A</Id>
                        </Stmt>
                        <Stmt>
                            <Id>STMT-B</Id>
                        </Stmt>
                    </BkToCstmrStmt>
                </Document>`;

            const result = parseCamt053(xml);
            expect(result.length).toBe(2);
            expect(result[0].id).toBe("STMT-A");
            expect(result[1].id).toBe("STMT-B");
        });
    });

    describe("parseCamt052", () => {
        it("returns empty array for empty string", () => {
            expect(parseCamt052("")).toEqual([]);
        });

        it("parses a basic camt.052 report", () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
                <Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.052.001.02">
                    <BkToCstmrAcctRpt>
                        <Rpt>
                            <Id>RPT001</Id>
                            <Ntry>
                                <Amt Ccy="EUR">200.00</Amt>
                                <CdtDbtInd>CRDT</CdtDbtInd>
                            </Ntry>
                        </Rpt>
                    </BkToCstmrAcctRpt>
                </Document>`;

            const result = parseCamt052(xml);
            expect(result.length).toBe(1);
            expect(result[0].id).toBe("RPT001");
            expect(result[0].entries.length).toBe(1);
            expect(result[0].entries[0].amount).toBe(200.0);
        });
    });
});
