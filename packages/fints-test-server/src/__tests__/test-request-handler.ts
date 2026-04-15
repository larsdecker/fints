import { FinTSRequestHandler } from "../request-handler";
import { createDefaultConfig } from "../test-data";
import { parse, parseSegment, extractInnerSegments } from "../protocol";

describe("FinTSRequestHandler", () => {
    let handler: FinTSRequestHandler;
    const config = createDefaultConfig();

    beforeEach(() => {
        handler = new FinTSRequestHandler(config);
    });

    /**
     * Build a minimal FinTS client request for testing.
     * This mimics the message format the PinTanClient sends.
     */
    function buildClientRequest(options: {
        dialogId?: string;
        msgNo?: number;
        systemId?: string;
        userName?: string;
        pin?: string;
        innerSegments: string[];
    }): string {
        const {
            dialogId = "0",
            msgNo = 1,
            systemId = "0",
            userName = "testuser",
            pin = "12345",
            innerSegments,
        } = options;

        const hnshk = `HNSHK:2:4+PIN:1+999+5555555+1+1+2::${systemId}+0+1:20180101:120000+1:999:1+6:10:16+280:12345678:${userName}:S:0:0'`;
        const hnsha = `HNSHA:${innerSegments.length + 3}:2+5555555++${pin}'`;
        const innerContent = hnshk + innerSegments.join("") + hnsha;
        const hnvsk = `HNVSK:998:3+PIN:1+998+1+1::${systemId}+1:20180101:120000+2:2:13:@8@00000000:5:1+280:12345678:${userName}:V:0:0+0'`;
        const hnvsd = `HNVSD:999:1+@${innerContent.length}@${innerContent}'`;
        const hnhbs = `HNHBS:${innerSegments.length + 4}:1+${msgNo}'`;

        const body = hnvsk + hnvsd + hnhbs;
        const totalLen = `HNHBK:1:3+`.length + 12 + `+300+${dialogId}+${msgNo}'`.length + body.length;
        const lenStr = String(totalLen).padStart(12, "0");
        const hnhbk = `HNHBK:1:3+${lenStr}+300+${dialogId}+${msgNo}'`;

        return hnhbk + body;
    }

    function parseResponse(response: string) {
        const segments = parse(response).map(parseSegment);
        const inner = extractInnerSegments(segments);
        return { segments, inner };
    }

    describe("synchronization (HKSYN)", () => {
        it("should handle sync request and return system ID", () => {
            const request = buildClientRequest({
                innerSegments: [
                    "HKIDN:3:2+280:12345678+testuser+0+1'",
                    "HKVVB:4:2+0+0+fints+0.1'",
                    "HKSYN:5:2+0'",
                ],
            });

            const response = handler.processMessage(request);
            const { inner } = parseResponse(response);

            // Should have HIRMG
            const hirmg = inner.find((s) => s.type === "HIRMG");
            expect(hirmg).toBeDefined();

            // Should have HISYN
            const hisyn = inner.find((s) => s.type === "HISYN");
            expect(hisyn).toBeDefined();
            expect(hisyn!.dataGroups[0][0]).toMatch(/DDDA/);

            // Should have HIBPA
            const hibpa = inner.find((s) => s.type === "HIBPA");
            expect(hibpa).toBeDefined();

            // Should have HITANS
            const hitans = inner.find((s) => s.type === "HITANS");
            expect(hitans).toBeDefined();

            // Should have HISPAS
            const hispas = inner.find((s) => s.type === "HISPAS");
            expect(hispas).toBeDefined();

            // Should have HIUPD for each account
            const hiupds = inner.filter((s) => s.type === "HIUPD");
            expect(hiupds.length).toBe(config.accounts.length);

            // Should have HIKAZS
            const hikazs = inner.filter((s) => s.type === "HIKAZS");
            expect(hikazs.length).toBeGreaterThan(0);

            // Should have HISALS
            const hisals = inner.filter((s) => s.type === "HISALS");
            expect(hisals.length).toBeGreaterThan(0);
        });
    });

    describe("dialog lifecycle", () => {
        it("should handle init and end dialog", () => {
            // First sync to get system ID and dialog
            const syncReq = buildClientRequest({
                innerSegments: [
                    "HKIDN:3:2+280:12345678+testuser+0+1'",
                    "HKVVB:4:2+0+0+fints+0.1'",
                    "HKSYN:5:2+0'",
                ],
            });
            const syncResp = handler.processMessage(syncReq);
            const { segments: syncSegs } = parseResponse(syncResp);
            const hnhbk = syncSegs.find((s) => s.type === "HNHBK");
            const dialogId = hnhbk!.dataGroups[2][0];

            // End the sync dialog
            const endReq = buildClientRequest({
                dialogId,
                msgNo: 2,
                innerSegments: [
                    `HKEND:3:1+${dialogId}'`,
                ],
            });
            const endResp = handler.processMessage(endReq);
            const { inner: endInner } = parseResponse(endResp);

            const hirmg = endInner.find((s) => s.type === "HIRMG");
            expect(hirmg).toBeDefined();
            // Check for "Dialog beendet" return code (0100)
            const returnCodes = hirmg!.dataGroups.map((dg) => dg[0]);
            expect(returnCodes).toContain("0100");
        });

        it("should handle init with HKIDN+HKVVB", () => {
            const initReq = buildClientRequest({
                innerSegments: [
                    "HKIDN:3:2+280:12345678+testuser+0+1'",
                    "HKVVB:4:2+0+0+fints+0.1'",
                    "HKTAN:5:6+4+++++++'",
                ],
            });

            const response = handler.processMessage(initReq);
            const { inner } = parseResponse(response);

            const hirmg = inner.find((s) => s.type === "HIRMG");
            expect(hirmg).toBeDefined();

            // Should contain success/warning codes
            const returnCodes = inner
                .filter((s) => s.type === "HIRMS")
                .flatMap((s) => s.dataGroups.map((dg) => dg[0]));
            expect(returnCodes.some((c) => c.startsWith("0") || c.startsWith("3"))).toBe(true);
        });
    });

    describe("HKSPA (SEPA accounts)", () => {
        it("should return account list", () => {
            // First init a dialog
            const initReq = buildClientRequest({
                innerSegments: [
                    "HKIDN:3:2+280:12345678+testuser+0+1'",
                    "HKVVB:4:2+0+0+fints+0.1'",
                ],
            });
            const initResp = handler.processMessage(initReq);
            const { segments: initSegs } = parseResponse(initResp);
            const dialogId = initSegs.find((s) => s.type === "HNHBK")!.dataGroups[2][0];

            // Request SEPA accounts
            const spaReq = buildClientRequest({
                dialogId,
                msgNo: 2,
                innerSegments: [
                    "HKSPA:3:1+DE111234567800000001:GENODE00TES:1::280:12345678'",
                    "HKTAN:4:6+4+++++++'",
                ],
            });
            const spaResp = handler.processMessage(spaReq);
            const { inner } = parseResponse(spaResp);

            const hispa = inner.find((s) => s.type === "HISPA");
            expect(hispa).toBeDefined();

            // Check that we got back our test accounts
            const ibans = hispa!.dataGroups.map((dg) => dg[1]);
            expect(ibans).toContain("DE111234567800000001");
            expect(ibans).toContain("DE111234567800000002");
        });
    });

    describe("HKSAL (balance)", () => {
        it("should return account balance", () => {
            // Init dialog
            const initReq = buildClientRequest({
                innerSegments: [
                    "HKIDN:3:2+280:12345678+testuser+0+1'",
                    "HKVVB:4:2+0+0+fints+0.1'",
                ],
            });
            const initResp = handler.processMessage(initReq);
            const { segments: initSegs } = parseResponse(initResp);
            const dialogId = initSegs.find((s) => s.type === "HNHBK")!.dataGroups[2][0];

            // Request balance (version 7: IBAN:BIC:accountNumber:subAccount:countryCode:BLZ)
            const salReq = buildClientRequest({
                dialogId,
                msgNo: 2,
                innerSegments: [
                    "HKSAL:3:7+DE111234567800000001:GENODE00TES:1::280:12345678+N'",
                    "HKTAN:4:6+4+++++++'",
                ],
            });
            const salResp = handler.processMessage(salReq);
            const { inner } = parseResponse(salResp);

            const hisal = inner.find((s) => s.type === "HISAL");
            expect(hisal).toBeDefined();

            // Check account number is in the response
            expect(hisal!.dataGroups[0][0]).toBe("1");
            // Check currency
            expect(hisal!.dataGroups[2][0]).toBe("EUR");
        });
    });

    describe("HKKAZ (statements)", () => {
        it("should return MT940 transaction data", () => {
            // Init dialog
            const initReq = buildClientRequest({
                innerSegments: [
                    "HKIDN:3:2+280:12345678+testuser+0+1'",
                    "HKVVB:4:2+0+0+fints+0.1'",
                ],
            });
            const initResp = handler.processMessage(initReq);
            const { segments: initSegs } = parseResponse(initResp);
            const dialogId = initSegs.find((s) => s.type === "HNHBK")!.dataGroups[2][0];

            // Request statements (version 7: IBAN:BIC:accountNumber:subAccount:countryCode:BLZ)
            const kazReq = buildClientRequest({
                dialogId,
                msgNo: 2,
                innerSegments: [
                    "HKKAZ:3:7+DE111234567800000001:GENODE00TES:1::280:12345678+N+20180101+20181001'",
                    "HKTAN:4:6+4+++++++'",
                ],
            });
            const kazResp = handler.processMessage(kazReq);
            const { inner } = parseResponse(kazResp);

            const hikaz = inner.find((s) => s.type === "HIKAZ");
            expect(hikaz).toBeDefined();

            // The MT940 data should be in the first data group
            const mt940 = hikaz!.dataGroups[0][0];
            expect(mt940).toContain(":20:STARTUMS");
            expect(mt940).toContain(":25:");
            expect(mt940).toContain(":60F:");
            expect(mt940).toContain(":61:");
            expect(mt940).toContain(":62F:");
        });
    });

    describe("error handling", () => {
        it("should reject requests for unknown dialogId", () => {
            const req = buildClientRequest({
                dialogId: "INVALID_DIALOG",
                msgNo: 2,
                innerSegments: [
                    "HKSAL:3:7+1::280:12345678+N'",
                ],
            });

            const response = handler.processMessage(req);
            const { inner } = parseResponse(response);

            // Should contain an error code (9xxx)
            const hirmg = inner.find((s) => s.type === "HIRMG");
            expect(hirmg).toBeDefined();
            const errorCodes = hirmg!.dataGroups.map((dg) => dg[0]);
            expect(errorCodes.some((c) => c.startsWith("9"))).toBe(true);
        });
    });

    describe("reset", () => {
        it("should clear all sessions", () => {
            // Create a dialog
            const initReq = buildClientRequest({
                innerSegments: [
                    "HKIDN:3:2+280:12345678+testuser+0+1'",
                    "HKVVB:4:2+0+0+fints+0.1'",
                ],
            });
            handler.processMessage(initReq);

            // Reset
            handler.reset();

            // The old dialog should no longer work
            const req = buildClientRequest({
                dialogId: "DIA_10000001",
                msgNo: 2,
                innerSegments: [
                    "HKSAL:3:7+1::280:12345678+N'",
                ],
            });
            const response = handler.processMessage(req);
            const { inner } = parseResponse(response);

            const hirmg = inner.find((s) => s.type === "HIRMG");
            const errorCodes = hirmg!.dataGroups.map((dg) => dg[0]);
            expect(errorCodes.some((c) => c.startsWith("9"))).toBe(true);
        });
    });
});
