/**
 * FinTS 4.1 Specification Conformance Tests
 *
 * These tests validate our implementation against the FinTS 4.1 specification
 * (FinTS_4.1_Master_2018-11-29_final_version.pdf).
 *
 * The tests use realistic XML messages that follow the exact structure
 * defined in the specification, including:
 *
 * - Correct XML namespace (urn:org:fints:4.1)
 * - Message envelope structure (MsgHead, MsgBody, MsgTail)
 * - Security profile (PIN/TAN with SignatureHeader/SignatureTrailer)
 * - Return codes as defined in the specification
 * - Complete dialog workflows (Sync → Init → BusinessTransaction → End)
 * - camt.053 (ISO 20022) compliant account statement format
 * - BPD/UPD parameter data structures
 * - TAN method negotiation per specification
 */
import { FINTS_NAMESPACE, FINTS_VERSION, COUNTRY_CODE } from "../constants";
import { PRODUCT_VERSION } from "../../constants";
import { buildMessage } from "../xml-builder";
import { parseResponse, isFinTS4Response, isErrorCode } from "../xml-parser";
import { parseCamt053 } from "../camt-parser";
import { FinTS4Dialog } from "../dialog";
import { FinTS4Client } from "../client";
import {
    buildDialogInitSegment,
    buildDialogEndSegment,
    buildSyncSegment,
    buildAccountListSegment,
    buildAccountStatementSegment,
    buildBalanceSegment,
    buildTanSegment,
} from "../segments";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockConnection(responses: string[]): { send: jest.Mock; calls: string[] } {
    let idx = 0;
    const calls: string[] = [];
    return {
        calls,
        send: jest.fn(async (xml: string) => {
            calls.push(xml);
            if (idx >= responses.length) throw new Error("No more mock responses");
            return responses[idx++];
        }),
    };
}

const dialogConfig = {
    blz: "76050101",
    name: "testkundenid",
    pin: "12345",
    systemId: "0",
    productId: "fintsTestProduct",
};

// ---------------------------------------------------------------------------
// §B.5 – FinTS 4.1 Return Codes (Rückmeldungen)
// The specification defines specific return codes for different situations.
// ---------------------------------------------------------------------------

describe("FinTS 4.1 Specification: Return Codes (§B.5)", () => {
    describe("Informational codes (0xxx)", () => {
        it("0010 – Nachricht entgegengenommen (message accepted)", () => {
            expect(isErrorCode("0010")).toBe(false);
        });

        it("0020 – Auftrag ausgeführt (order executed)", () => {
            expect(isErrorCode("0020")).toBe(false);
        });

        it("0100 – Dialog beendet (dialog ended)", () => {
            expect(isErrorCode("0100")).toBe(false);
        });
    });

    describe("Warning codes (3xxx)", () => {
        it("3010 – Es liegen weitere Informationen vor (more information available)", () => {
            expect(isErrorCode("3010")).toBe(false);
        });

        it("3040 – Auftragsbezogene Rückmeldung: Touchdown (pagination token)", () => {
            expect(isErrorCode("3040")).toBe(false);
        });

        it("3920 – Zugelassene TAN-Verfahren für den Benutzer (allowed TAN methods)", () => {
            expect(isErrorCode("3920")).toBe(false);
        });

        it("3076 – Starke Kundenauthentifizierung erforderlich (SCA required)", () => {
            expect(isErrorCode("3076")).toBe(false);
        });

        it("3956 – Decoupled TAN pending", () => {
            expect(isErrorCode("3956")).toBe(false);
        });
    });

    describe("Error codes (9xxx)", () => {
        it("9010 – Verarbeitung nicht möglich (processing not possible)", () => {
            expect(isErrorCode("9010")).toBe(true);
        });

        it("9050 – Teilweise fehlerhaft (partially erroneous)", () => {
            expect(isErrorCode("9050")).toBe(true);
        });

        it("9340 – PIN ungültig (invalid PIN)", () => {
            expect(isErrorCode("9340")).toBe(true);
        });

        it("9800 – Dialog wurde nicht korrekt beendet (dialog not correctly ended)", () => {
            expect(isErrorCode("9800")).toBe(true);
        });

        it("9931 – Zugang gesperrt (access blocked)", () => {
            expect(isErrorCode("9931")).toBe(true);
        });

        it("9942 – PIN gesperrt (PIN blocked)", () => {
            expect(isErrorCode("9942")).toBe(true);
        });
    });
});

// ---------------------------------------------------------------------------
// §B.3 – FinTS 4.1 Message Envelope Structure
// The specification defines the XML message envelope with MsgHead, MsgBody, MsgTail.
// ---------------------------------------------------------------------------

describe("FinTS 4.1 Specification: Message Envelope (§B.3)", () => {
    it("produces a well-formed XML message with correct namespace", () => {
        const msg = buildMessage({
            msgNo: 1,
            dialogId: "0",
            segments: [buildDialogInitSegment({ segNo: 1, blz: "76050101", name: "test", systemId: "0" })],
            blz: "76050101",
            name: "test",
            pin: "12345",
            systemId: "0",
        });

        // Must start with XML declaration
        expect(msg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
        // Must use FinTS 4.1 namespace
        expect(msg).toContain(`xmlns="${FINTS_NAMESPACE}"`);
        // Must contain all three envelope parts
        expect(msg).toContain("<MsgHead>");
        expect(msg).toContain("<MsgBody>");
        expect(msg).toContain("<MsgTail>");
    });

    it("MsgHead contains correct fields per specification", () => {
        const msg = buildMessage({
            msgNo: 3,
            dialogId: "dialog-42",
            segments: [],
            blz: "76050101",
            name: "kundenid",
            pin: "secret",
            systemId: "sys-abc",
            productId: "myProd",
        });

        // §B.3.1 – MsgNo: Nachrichtennummer
        expect(msg).toContain("<MsgNo>3</MsgNo>");
        // §B.3.1 – DialogID: Eindeutige Dialog-Kennung
        expect(msg).toContain("<DialogID>dialog-42</DialogID>");
        // §B.3.1 – HBCIVersion: Protokollversion
        expect(msg).toContain(`<HBCIVersion>${FINTS_VERSION}</HBCIVersion>`);
        // §B.3.1 – Initiator: Kreditinstitut (BLZ) und Landeskennzeichen
        expect(msg).toContain("<BLZ>76050101</BLZ>");
        expect(msg).toContain(`<CountryCode>${COUNTRY_CODE}</CountryCode>`);
        // §B.3.1 – SystemID
        expect(msg).toContain("<SystemID>sys-abc</SystemID>");
        // §B.3.1 – Produktkennung
        expect(msg).toContain("<Name>myProd</Name>");
        expect(msg).toContain(`<Version>${PRODUCT_VERSION}</Version>`);
    });

    it("MsgTail contains message number matching MsgHead", () => {
        const msg = buildMessage({
            msgNo: 7,
            dialogId: "0",
            segments: [],
            blz: "12345678",
            name: "user",
            pin: "pin",
            systemId: "0",
        });

        // §B.3.3 – MsgTail must repeat the message number
        expect(msg).toContain("<MsgTail><MsgNo>7</MsgNo></MsgTail>");
    });
});

// ---------------------------------------------------------------------------
// §B.4 – FinTS 4.1 Security Profile (PIN/TAN)
// The specification defines how PIN/TAN authentication works in v4.1.
// ---------------------------------------------------------------------------

describe("FinTS 4.1 Specification: Security Profile PIN/TAN (§B.4)", () => {
    it("embeds SignatureHeader with security function and method", () => {
        const msg = buildMessage({
            msgNo: 1,
            dialogId: "0",
            segments: [],
            blz: "12345678",
            name: "kundenid",
            pin: "geheim",
            systemId: "0",
            securityFunction: "912",
        });

        // §B.4.1 – Sicherheitsfunktion
        expect(msg).toContain("<SecurityFunction>912</SecurityFunction>");
        // §B.4.1 – Sicherheitsverfahren
        expect(msg).toContain("<SecurityMethod>PIN_TAN</SecurityMethod>");
        // §B.4.1 – Benutzerkennung
        expect(msg).toContain("<UserID>kundenid</UserID>");
    });

    it("embeds PIN in SignatureTrailer", () => {
        const msg = buildMessage({
            msgNo: 1,
            dialogId: "0",
            segments: [],
            blz: "12345678",
            name: "user",
            pin: "mySecretPIN",
            systemId: "0",
        });

        // §B.4.2 – PIN im Signaturabschluss
        expect(msg).toContain("<SignatureTrailer>");
        expect(msg).toContain("<PIN>mySecretPIN</PIN>");
    });

    it("embeds TAN when provided for 2-factor auth", () => {
        const msg = buildMessage({
            msgNo: 1,
            dialogId: "0",
            segments: [],
            blz: "12345678",
            name: "user",
            pin: "pin",
            systemId: "0",
            tan: "654321",
        });

        // §B.4.2 – TAN im Signaturabschluss
        expect(msg).toContain("<TAN>654321</TAN>");
    });

    it("SignatureHeader precedes segments, SignatureTrailer follows", () => {
        const msg = buildMessage({
            msgNo: 1,
            dialogId: "0",
            segments: [{ type: "TestSeg", version: 1, segNo: 1, body: "<X>1</X>" }],
            blz: "12345678",
            name: "user",
            pin: "pin",
            systemId: "0",
        });

        const headerIdx = msg.indexOf("<SignatureHeader>");
        const segIdx = msg.indexOf("<Type>TestSeg</Type>");
        const trailerIdx = msg.indexOf("<SignatureTrailer>");

        // Order: Header < Segment < Trailer
        expect(headerIdx).toBeLessThan(segIdx);
        expect(segIdx).toBeLessThan(trailerIdx);
    });
});

// ---------------------------------------------------------------------------
// §C.1 – FinTS 4.1 Dialog Lifecycle
// The specification defines the exact sequence:
// Synchronisation → DialogInitialisierung → Geschäftsvorfall(e) → Dialogende
// ---------------------------------------------------------------------------

describe("FinTS 4.1 Specification: Dialog Lifecycle (§C.1)", () => {
    /**
     * Complete synchronization response per spec:
     * - Return code 0010 (Nachricht entgegengenommen)
     * - SyncRes with SystemID
     * - BPD with bank parameters
     * - TANMethods with available TAN methods
     * - Parameter segments advertising capabilities
     */
    function specSyncResponse(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
            <FinTSMessage xmlns="${FINTS_NAMESPACE}">
                <MsgHead>
                    <MsgNo>1</MsgNo>
                    <DialogID>sync-4711</DialogID>
                    <HBCIVersion>${FINTS_VERSION}</HBCIVersion>
                </MsgHead>
                <MsgBody>
                    <ReturnValue>
                        <Code>0010</Code>
                        <Message>Nachricht entgegengenommen</Message>
                    </ReturnValue>
                    <ReturnValue>
                        <Code>3920</Code>
                        <Message>Zugelassene Ein- und Zwei-Schritt-Verfahren für den Benutzer</Message>
                        <Parameter>912</Parameter>
                        <Parameter>913</Parameter>
                    </ReturnValue>
                    <Segment>
                        <SegHead><Type>SyncRes</Type><Version>1</Version><SegNo>1</SegNo></SegHead>
                        <SegBody><SystemID>0000000001</SystemID></SegBody>
                    </Segment>
                    <Segment>
                        <SegHead><Type>BPD</Type><Version>1</Version><SegNo>2</SegNo></SegHead>
                        <SegBody>
                            <BPD>
                                <BankName>Sparkasse Nürnberg</BankName>
                                <BPDVersion>85</BPDVersion>
                                <Version>4.1</Version>
                                <Language>de</Language>
                                <SecurityMethod>PIN_TAN</SecurityMethod>
                                <PainFormat>urn:iso:std:iso:20022:tech:xsd:pain.001.003.03</PainFormat>
                                <CamtFormat>urn:iso:std:iso:20022:tech:xsd:camt.053.001.02</CamtFormat>
                                <CamtFormat>urn:iso:std:iso:20022:tech:xsd:camt.052.001.02</CamtFormat>
                            </BPD>
                        </SegBody>
                    </Segment>
                    <Segment>
                        <SegHead><Type>TANMethods</Type><Version>7</Version><SegNo>3</SegNo></SegHead>
                        <SegBody>
                            <TANMethod>
                                <SecurityFunction>912</SecurityFunction>
                                <TANProcess>2</TANProcess>
                                <TechID>pushTAN</TechID>
                                <Name>pushTAN 2.0</Name>
                                <MaxLengthInput>6</MaxLengthInput>
                                <AllowedFormat>1</AllowedFormat>
                                <Cancellable>true</Cancellable>
                                <DecoupledMaxStatusRequests>60</DecoupledMaxStatusRequests>
                                <DecoupledWaitBeforeFirstStatusRequest>5</DecoupledWaitBeforeFirstStatusRequest>
                                <DecoupledWaitBetweenStatusRequests>2</DecoupledWaitBetweenStatusRequests>
                            </TANMethod>
                            <TANMethod>
                                <SecurityFunction>913</SecurityFunction>
                                <TANProcess>1</TANProcess>
                                <TechID>chipTAN</TechID>
                                <Name>chipTAN QR</Name>
                                <MaxLengthInput>8</MaxLengthInput>
                                <AllowedFormat>0</AllowedFormat>
                                <Cancellable>false</Cancellable>
                            </TANMethod>
                        </SegBody>
                    </Segment>
                    <Segment>
                        <SegHead><Type>Balance</Type><Version>7</Version><SegNo>4</SegNo></SegHead>
                        <SegBody></SegBody>
                    </Segment>
                    <Segment>
                        <SegHead><Type>AccountStatement</Type><Version>2</Version><SegNo>5</SegNo></SegHead>
                        <SegBody></SegBody>
                    </Segment>
                    <Segment>
                        <SegHead><Type>TAN</Type><Version>7</Version><SegNo>6</SegNo></SegHead>
                        <SegBody></SegBody>
                    </Segment>
                </MsgBody>
                <MsgTail><MsgNo>1</MsgNo></MsgTail>
            </FinTSMessage>`;
    }

    function specSuccessResponse(dialogId: string): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
            <FinTSMessage xmlns="${FINTS_NAMESPACE}">
                <MsgHead><MsgNo>1</MsgNo><DialogID>${dialogId}</DialogID></MsgHead>
                <MsgBody>
                    <ReturnValue><Code>0010</Code><Message>Nachricht entgegengenommen</Message></ReturnValue>
                </MsgBody>
                <MsgTail><MsgNo>1</MsgNo></MsgTail>
            </FinTSMessage>`;
    }

    function specDialogEndResponse(): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
            <FinTSMessage xmlns="${FINTS_NAMESPACE}">
                <MsgHead><MsgNo>1</MsgNo><DialogID>0</DialogID></MsgHead>
                <MsgBody>
                    <ReturnValue><Code>0100</Code><Message>Dialog beendet</Message></ReturnValue>
                </MsgBody>
                <MsgTail><MsgNo>1</MsgNo></MsgTail>
            </FinTSMessage>`;
    }

    it("§C.1.1 – Sync dialog: obtains SystemID, BPD, TAN methods", async () => {
        const conn = createMockConnection([specSyncResponse(), specDialogEndResponse()]);
        const dialog = new FinTS4Dialog(dialogConfig, conn);

        await dialog.sync();

        // SystemID assigned by server
        expect(dialog.systemId).toBe("0000000001");

        // BPD parsed
        expect(dialog.bpd).toBeDefined();
        expect(dialog.bpd!.bankName).toBe("Sparkasse Nürnberg");
        expect(dialog.bpd!.bpdVersion).toBe(85);

        // TAN methods parsed (both pushTAN and chipTAN)
        expect(dialog.tanMethods).toHaveLength(2);
        expect(dialog.tanMethods[0].securityFunction).toBe("912");
        expect(dialog.tanMethods[0].name).toBe("pushTAN 2.0");
        expect(dialog.tanMethods[0].decoupledMaxStatusRequests).toBe(60);
        expect(dialog.tanMethods[1].securityFunction).toBe("913");
        expect(dialog.tanMethods[1].name).toBe("chipTAN QR");
    });

    it("§C.1.1 – Sync dialog detects bank capabilities from parameter segments", async () => {
        const conn = createMockConnection([specSyncResponse(), specDialogEndResponse()]);
        const dialog = new FinTS4Dialog(dialogConfig, conn);

        await dialog.sync();

        // Capabilities derived from segment versions
        expect(dialog.supportsBalance).toBe(true);
        expect(dialog.balanceVersion).toBe(7);
        expect(dialog.supportsStatements).toBe(true);
        expect(dialog.statementVersion).toBe(2);
        expect(dialog.tanVersion).toBe(7);
    });

    it("§C.1.1 – Sync negotiates security function from TAN methods", async () => {
        const conn = createMockConnection([specSyncResponse(), specDialogEndResponse()]);
        const dialog = new FinTS4Dialog(dialogConfig, conn);

        await dialog.sync();

        // Should use first TAN method's security function (no 999 method available)
        expect(dialog.securityFunction).toBe("912");
    });

    it("§C.1.2 – Full dialog lifecycle: sync → init → business → end", async () => {
        const conn = createMockConnection([
            specSyncResponse(),       // 1. sync
            specDialogEndResponse(),  // 2. end sync dialog
            specSuccessResponse("init-d1"), // 3. init new dialog
            specSuccessResponse("init-d1"), // 4. business transaction
            specDialogEndResponse(),  // 5. end business dialog
        ]);

        const dialog = new FinTS4Dialog(dialogConfig, conn);

        // Step 1: Synchronization (assigns SystemID, reads BPD)
        await dialog.sync();
        expect(dialog.systemId).toBe("0000000001");

        // Step 2: Initialize business dialog
        await dialog.init();
        expect(dialog.dialogId).toBe("init-d1");

        // Step 3: Send business transaction (e.g., account list)
        const response = await dialog.send([buildAccountListSegment({ segNo: 3 })]);
        expect(response.success).toBe(true);

        // Step 4: End dialog
        await dialog.end();
        expect(dialog.dialogId).toBe("0");
        expect(dialog.msgNo).toBe(1);

        // Verify 5 messages were sent
        expect(conn.calls.length).toBe(5);
    });

    it("§C.1.3 – DialogInit request contains required segments", async () => {
        const conn = createMockConnection([specSuccessResponse("d1")]);
        const dialog = new FinTS4Dialog(dialogConfig, conn);
        dialog.tanMethods = [
            {
                securityFunction: "912",
                tanProcess: "2",
                techId: "pushTAN",
                name: "pushTAN 2.0",
                maxLengthInput: 6,
                allowedFormat: "1",
                tanListNumberRequired: false,
                cancellable: true,
            },
        ];
        dialog.tanVersion = 7;

        await dialog.init();

        const requestXml = conn.calls[0];
        // Must contain DialogInit segment
        expect(requestXml).toContain("<Type>DialogInit</Type>");
        // Must contain TAN segment for SCA (§B.4)
        expect(requestXml).toContain("<Type>TAN</Type>");
        // Must contain security envelope
        expect(requestXml).toContain("<SignatureHeader>");
        expect(requestXml).toContain("<SignatureTrailer>");
    });

    it("§C.1.4 – DialogEnd request contains DialogID", async () => {
        const conn = createMockConnection([specDialogEndResponse()]);
        const dialog = new FinTS4Dialog(dialogConfig, conn);
        dialog.dialogId = "dialog-to-end";

        await dialog.end();

        const requestXml = conn.calls[0];
        expect(requestXml).toContain("<Type>DialogEnd</Type>");
        expect(requestXml).toContain("<DialogID>dialog-to-end</DialogID>");
    });

    it("§C.1.5 – Error response (9010) causes dialog to fail", async () => {
        const errorResponse = `<?xml version="1.0" encoding="UTF-8"?>
            <FinTSMessage xmlns="${FINTS_NAMESPACE}">
                <MsgHead><MsgNo>1</MsgNo><DialogID>err-d1</DialogID></MsgHead>
                <MsgBody>
                    <ReturnValue>
                        <Code>9010</Code>
                        <Message>Verarbeitung nicht möglich</Message>
                    </ReturnValue>
                </MsgBody>
            </FinTSMessage>`;

        const conn = createMockConnection([errorResponse]);
        const dialog = new FinTS4Dialog(dialogConfig, conn);

        await expect(dialog.send([buildAccountListSegment({ segNo: 1 })])).rejects.toThrow(
            "FinTS 4.1 request failed: 9010: Verarbeitung nicht möglich",
        );
    });

    it("§C.1.5 – Multiple error codes in response are all reported", async () => {
        const multiErrorResponse = `<?xml version="1.0" encoding="UTF-8"?>
            <FinTSMessage xmlns="${FINTS_NAMESPACE}">
                <MsgHead><MsgNo>1</MsgNo><DialogID>err-d1</DialogID></MsgHead>
                <MsgBody>
                    <ReturnValue>
                        <Code>9010</Code>
                        <Message>Verarbeitung nicht möglich</Message>
                    </ReturnValue>
                    <ReturnValue>
                        <Code>9340</Code>
                        <Message>PIN ungültig</Message>
                    </ReturnValue>
                </MsgBody>
            </FinTSMessage>`;

        const conn = createMockConnection([multiErrorResponse]);
        const dialog = new FinTS4Dialog(dialogConfig, conn);

        await expect(dialog.send([{ type: "Test", version: 1, segNo: 1, body: "" }])).rejects.toThrow(
            /9010.*9340/,
        );
    });
});

// ---------------------------------------------------------------------------
// §D.3 – FinTS 4.1 Account Statement (HKCAZ / camt.053)
// The specification uses ISO 20022 camt.053.001.02 for account statements.
// ---------------------------------------------------------------------------

describe("FinTS 4.1 Specification: Account Statements / camt.053 (§D.3)", () => {
    /**
     * A realistic camt.053.001.02 document as returned by a German bank,
     * following the ISO 20022 standard.
     */
    const realisticCamt053 = `<?xml version="1.0" encoding="UTF-8"?>
        <Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
            <BkToCstmrStmt>
                <GrpHdr>
                    <MsgId>MSG-2024-01-15-001</MsgId>
                    <CreDtTm>2024-01-15T23:59:00+01:00</CreDtTm>
                </GrpHdr>
                <Stmt>
                    <Id>2024-01-15-001</Id>
                    <ElctrncSeqNb>42</ElctrncSeqNb>
                    <CreDtTm>2024-01-15T23:59:00+01:00</CreDtTm>
                    <Acct>
                        <Id><IBAN>DE89370400440532013000</IBAN></Id>
                        <Ccy>EUR</Ccy>
                        <Svcr>
                            <FinInstnId>
                                <BIC>COBADEFFXXX</BIC>
                            </FinInstnId>
                        </Svcr>
                    </Acct>
                    <Bal>
                        <Tp><CdOrPrtry><Cd>PRCD</Cd></CdOrPrtry></Tp>
                        <Amt Ccy="EUR">5432.10</Amt>
                        <CdtDbtInd>CRDT</CdtDbtInd>
                        <Dt><Dt>2024-01-14</Dt></Dt>
                    </Bal>
                    <Bal>
                        <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
                        <Amt Ccy="EUR">5782.10</Amt>
                        <CdtDbtInd>CRDT</CdtDbtInd>
                        <Dt><Dt>2024-01-15</Dt></Dt>
                    </Bal>
                    <Ntry>
                        <NtryRef>2024011500001</NtryRef>
                        <Amt Ccy="EUR">500.00</Amt>
                        <CdtDbtInd>CRDT</CdtDbtInd>
                        <Sts>BOOK</Sts>
                        <BookgDt><Dt>2024-01-15</Dt></BookgDt>
                        <ValDt><Dt>2024-01-15</Dt></ValDt>
                        <BkTxCd>
                            <Domn>
                                <Cd>PMNT</Cd>
                                <Fmly>
                                    <Cd>RCDT</Cd>
                                    <SubFmlyCd>ESCT</SubFmlyCd>
                                </Fmly>
                            </Domn>
                        </BkTxCd>
                        <NtryDtls>
                            <TxDtls>
                                <Refs>
                                    <EndToEndId>SALARY-2024-01</EndToEndId>
                                    <MndtId>MNDT-SALARY-001</MndtId>
                                </Refs>
                                <RltdPties>
                                    <Dbtr>
                                        <Nm>Arbeitgeber GmbH</Nm>
                                    </Dbtr>
                                    <DbtrAcct>
                                        <Id><IBAN>DE44500105175407324931</IBAN></Id>
                                    </DbtrAcct>
                                </RltdPties>
                                <RltdAgts>
                                    <DbtrAgt>
                                        <FinInstnId>
                                            <BIC>INGDDEFFXXX</BIC>
                                        </FinInstnId>
                                    </DbtrAgt>
                                </RltdAgts>
                                <RmtInf>
                                    <Ustrd>Gehalt Januar 2024</Ustrd>
                                </RmtInf>
                            </TxDtls>
                        </NtryDtls>
                    </Ntry>
                    <Ntry>
                        <NtryRef>2024011500002</NtryRef>
                        <Amt Ccy="EUR">150.00</Amt>
                        <CdtDbtInd>DBIT</CdtDbtInd>
                        <Sts>BOOK</Sts>
                        <BookgDt><Dt>2024-01-15</Dt></BookgDt>
                        <ValDt><Dt>2024-01-15</Dt></ValDt>
                        <BkTxCd>
                            <Domn>
                                <Cd>PMNT</Cd>
                                <Fmly>
                                    <Cd>ICDT</Cd>
                                    <SubFmlyCd>ESCT</SubFmlyCd>
                                </Fmly>
                            </Domn>
                        </BkTxCd>
                        <NtryDtls>
                            <TxDtls>
                                <Refs>
                                    <EndToEndId>RENT-2024-01</EndToEndId>
                                </Refs>
                                <RltdPties>
                                    <Cdtr>
                                        <Nm>Vermieter Immobilien AG</Nm>
                                    </Cdtr>
                                    <CdtrAcct>
                                        <Id><IBAN>DE27100777770209299700</IBAN></Id>
                                    </CdtrAcct>
                                </RltdPties>
                                <RmtInf>
                                    <Ustrd>Miete Januar 2024 Wohnung 4B</Ustrd>
                                </RmtInf>
                            </TxDtls>
                        </NtryDtls>
                    </Ntry>
                </Stmt>
            </BkToCstmrStmt>
        </Document>`;

    it("parses ISO 20022 camt.053.001.02 statement with balances", () => {
        const stmts = parseCamt053(realisticCamt053);

        expect(stmts).toHaveLength(1);
        const stmt = stmts[0];
        expect(stmt.id).toBe("2024-01-15-001");
        expect(stmt.iban).toBe("DE89370400440532013000");

        // Opening balance (PRCD = Previous Closing Date balance)
        expect(stmt.openingBalance).toBe(5432.10);
        // Closing balance
        expect(stmt.closingBalance).toBe(5782.10);
        expect(stmt.currency).toBe("EUR");
    });

    it("correctly parses credit entry (Gutschrift / Gehaltseingang)", () => {
        const stmts = parseCamt053(realisticCamt053);
        const entry = stmts[0].entries[0];

        expect(entry.entryReference).toBe("2024011500001");
        expect(entry.amount).toBe(500.00); // Positive for credit
        expect(entry.currency).toBe("EUR");
        expect(entry.creditDebitIndicator).toBe("CRDT");
        expect(entry.bookingDate).toEqual(new Date("2024-01-15"));
        expect(entry.valueDate).toEqual(new Date("2024-01-15"));
        expect(entry.bankTransactionCode).toBe("PMNT");
        expect(entry.counterpartyName).toBe("Arbeitgeber GmbH");
        expect(entry.counterpartyIban).toBe("DE44500105175407324931");
        expect(entry.counterpartyBic).toBe("INGDDEFFXXX");
        expect(entry.endToEndReference).toBe("SALARY-2024-01");
        expect(entry.mandateReference).toBe("MNDT-SALARY-001");
        expect(entry.remittanceInformation).toBe("Gehalt Januar 2024");
    });

    it("correctly parses debit entry (Lastschrift / Miete)", () => {
        const stmts = parseCamt053(realisticCamt053);
        const entry = stmts[0].entries[1];

        expect(entry.entryReference).toBe("2024011500002");
        expect(entry.amount).toBe(-150.00); // Negative for debit
        expect(entry.creditDebitIndicator).toBe("DBIT");
        expect(entry.counterpartyName).toBe("Vermieter Immobilien AG");
        expect(entry.counterpartyIban).toBe("DE27100777770209299700");
        expect(entry.endToEndReference).toBe("RENT-2024-01");
        expect(entry.remittanceInformation).toBe("Miete Januar 2024 Wohnung 4B");
    });

    it("§D.3.1 – AccountStatement segment builder includes camt format URN", () => {
        const seg = buildAccountStatementSegment({
            segNo: 3,
            version: 2,
            account: {
                iban: "DE89370400440532013000",
                bic: "COBADEFFXXX",
                accountNumber: "0532013000",
                blz: "37040044",
            },
            startDate: new Date("2024-01-01"),
            endDate: new Date("2024-01-31"),
        });

        expect(seg.type).toBe("AccountStatement");
        expect(seg.version).toBe(2);
        // Must include the camt.053 URN as format identifier
        expect(seg.body).toContain("urn:iso:std:iso:20022:tech:xsd:camt.053.001.02");
        expect(seg.body).toContain("<StartDate>2024-01-01</StartDate>");
        expect(seg.body).toContain("<EndDate>2024-01-31</EndDate>");
    });
});

// ---------------------------------------------------------------------------
// §D.2 – FinTS 4.1 TAN Segment & Method Negotiation
// ---------------------------------------------------------------------------

describe("FinTS 4.1 Specification: TAN Method Negotiation (§D.2)", () => {
    it("parses decoupled TAN method parameters", () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
            <FinTSMessage xmlns="${FINTS_NAMESPACE}">
                <MsgHead><MsgNo>1</MsgNo><DialogID>d1</DialogID></MsgHead>
                <MsgBody>
                    <Segment>
                        <SegHead><Type>TANMethods</Type><Version>7</Version><SegNo>1</SegNo></SegHead>
                        <SegBody>
                            <TANMethod>
                                <SecurityFunction>912</SecurityFunction>
                                <TANProcess>2</TANProcess>
                                <TechID>pushTAN</TechID>
                                <Name>pushTAN 2.0</Name>
                                <MaxLengthInput>6</MaxLengthInput>
                                <AllowedFormat>1</AllowedFormat>
                                <TANListNumberRequired>false</TANListNumberRequired>
                                <Cancellable>true</Cancellable>
                                <DecoupledMaxStatusRequests>60</DecoupledMaxStatusRequests>
                                <DecoupledWaitBeforeFirstStatusRequest>5</DecoupledWaitBeforeFirstStatusRequest>
                                <DecoupledWaitBetweenStatusRequests>2</DecoupledWaitBetweenStatusRequests>
                            </TANMethod>
                        </SegBody>
                    </Segment>
                </MsgBody>
            </FinTSMessage>`;

        const response = parseResponse(xml);

        expect(response.tanMethods).toHaveLength(1);
        const method = response.tanMethods![0];
        expect(method.securityFunction).toBe("912");
        expect(method.tanProcess).toBe("2");
        expect(method.name).toBe("pushTAN 2.0");
        expect(method.maxLengthInput).toBe(6);
        expect(method.cancellable).toBe(true);
        // Decoupled parameters per FinTS 3.0+ PINTAN spec
        expect(method.decoupledMaxStatusRequests).toBe(60);
        expect(method.decoupledWaitBeforeFirstStatusRequest).toBe(5);
        expect(method.decoupledWaitBetweenStatusRequests).toBe(2);
    });

    it("TAN segment builder supports process='4' for SCA pre-dialog", () => {
        const seg = buildTanSegment({ segNo: 5, version: 7, process: "4" });
        expect(seg.body).toContain("<TANProcess>4</TANProcess>");
    });

    it("TAN segment builder supports process='2' for decoupled polling", () => {
        const seg = buildTanSegment({
            segNo: 5,
            version: 7,
            process: "2",
            aref: "TX-REF-4711",
        });
        expect(seg.body).toContain("<TANProcess>2</TANProcess>");
        expect(seg.body).toContain("<TransactionReference>TX-REF-4711</TransactionReference>");
    });
});

// ---------------------------------------------------------------------------
// §B.6 – Response Parsing for various server response scenarios
// ---------------------------------------------------------------------------

describe("FinTS 4.1 Specification: Response Parsing (§B.6)", () => {
    it("isFinTS4Response correctly identifies XML vs. v3.0 format", () => {
        // FinTS 4.1 XML response
        expect(isFinTS4Response('<?xml version="1.0" encoding="UTF-8"?><FinTSMessage/>')).toBe(true);
        expect(isFinTS4Response("<FinTSMessage><MsgHead/></FinTSMessage>")).toBe(true);

        // FinTS 3.0 proprietary format (starts with HNHBK segment)
        expect(isFinTS4Response("HNHBK:1:3+000000000152+300+0+1'")).toBe(false);
        // Base64-encoded (typical v3.0 HTTP response)
        expect(isFinTS4Response("SE5IQks6MTozKzAwMD")).toBe(false);
    });

    it("parses response with UPD (User Parameter Data)", () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
            <FinTSMessage>
                <MsgHead><MsgNo>1</MsgNo><DialogID>d1</DialogID></MsgHead>
                <MsgBody>
                    <Segment>
                        <SegHead><Type>UPD</Type><Version>1</Version><SegNo>1</SegNo></SegHead>
                        <SegBody>
                            <UPD>
                                <UPDVersion>3</UPDVersion>
                                <Account>
                                    <IBAN>DE89370400440532013000</IBAN>
                                    <BIC>COBADEFFXXX</BIC>
                                    <OwnerName>Max Mustermann</OwnerName>
                                    <AccountName>Girokonto</AccountName>
                                    <Transaction>HKCAZ</Transaction>
                                    <Transaction>HKSAL</Transaction>
                                </Account>
                            </UPD>
                        </SegBody>
                    </Segment>
                </MsgBody>
            </FinTSMessage>`;

        const response = parseResponse(xml);
        expect(response.upd).toBeDefined();
        expect(response.upd!.updVersion).toBe(3);
        expect(response.upd!.accounts).toHaveLength(1);
        expect(response.upd!.accounts![0].iban).toBe("DE89370400440532013000");
        expect(response.upd!.accounts![0].ownerName).toBe("Max Mustermann");
        expect(response.upd!.accounts![0].allowedTransactions).toEqual(["HKCAZ", "HKSAL"]);
    });

    it("parses BPD with segment version capabilities", () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
            <FinTSMessage>
                <MsgHead><MsgNo>1</MsgNo><DialogID>d1</DialogID></MsgHead>
                <MsgBody>
                    <Segment>
                        <SegHead><Type>BPD</Type><Version>1</Version><SegNo>1</SegNo></SegHead>
                        <SegBody>
                            <BPD>
                                <BankName>Deutsche Bank</BankName>
                                <BPDVersion>100</BPDVersion>
                                <Segment><Type>HICAZS</Type><Version>2</Version></Segment>
                                <Segment><Type>HISALS</Type><Version>7</Version></Segment>
                                <Segment><Type>HITANS</Type><Version>7</Version></Segment>
                            </BPD>
                        </SegBody>
                    </Segment>
                </MsgBody>
            </FinTSMessage>`;

        const response = parseResponse(xml);
        expect(response.bpd).toBeDefined();
        expect(response.bpd!.bankName).toBe("Deutsche Bank");

        // Segment versions from BPD are propagated to response
        expect(response.segmentVersions!.get("HICAZS")).toBe(2);
        expect(response.segmentVersions!.get("HISALS")).toBe(7);
        expect(response.segmentVersions!.get("HITANS")).toBe(7);
    });

    it("parses touchdown for paginated statement responses", () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
            <FinTSMessage>
                <MsgHead><MsgNo>1</MsgNo><DialogID>d1</DialogID></MsgHead>
                <MsgBody>
                    <ReturnValue>
                        <Code>3040</Code>
                        <Message>Es liegen weitere Informationen vor</Message>
                        <Parameter>ABCDEF1234567890</Parameter>
                    </ReturnValue>
                    <Segment>
                        <SegHead><Type>AccountStatement</Type><Version>2</Version><SegNo>3</SegNo></SegHead>
                        <SegBody>
                            <CamtData>first-page-camt-data</CamtData>
                        </SegBody>
                    </Segment>
                </MsgBody>
            </FinTSMessage>`;

        const response = parseResponse(xml);
        expect(response.touchdown).toBe("ABCDEF1234567890");
        expect(response.camtData).toBe("first-page-camt-data");
    });
});

// ---------------------------------------------------------------------------
// §E – FinTS 4.1 Bank Capabilities (derived from BPD)
// ---------------------------------------------------------------------------

describe("FinTS 4.1 Specification: Bank Capabilities (§E)", () => {
    it("capabilities reflect read-only support (no credit transfer, no direct debit)", () => {
        const conn = createMockConnection([]);
        const dialog = new FinTS4Dialog(dialogConfig, conn);
        dialog.supportsBalance = true;
        dialog.supportsStatements = true;

        const caps = dialog.capabilities;

        // Read-only operations
        expect(caps.supportsAccounts).toBe(true);
        expect(caps.supportsBalance).toBe(true);
        expect(caps.supportsTransactions).toBe(true);

        // Not yet implemented in v4.1 client
        expect(caps.supportsHoldings).toBe(false);
        expect(caps.supportsStandingOrders).toBe(false);
        expect(caps.supportsCreditTransfer).toBe(false);
        expect(caps.supportsDirectDebit).toBe(false);
    });
});
