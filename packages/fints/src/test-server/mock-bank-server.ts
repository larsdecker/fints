/**
 * FinTS 3.0 Mock Bank Server
 *
 * A simulated FinTS 3.0 server that processes `Request` objects and returns
 * `Response` objects with realistic test data. Designed for integration testing
 * of the FinTS 3.0 client without requiring a real bank connection.
 *
 * Features:
 * - Full dialog lifecycle support (Sync → Init → Business → End)
 * - PIN authentication validation
 * - Account listing (HISPA), balance queries (HISAL), statements (HIKAZ)
 * - Realistic return codes per FinTS 3.0 specification
 * - TAN method advertisement (HITANS)
 * - System ID assignment (HISYN)
 * - BPD and UPD segments
 */
import { Connection } from "../types";
import { Request } from "../request";
import { Response } from "../response";
import { parse } from "../utils";
import { HEADER_LENGTH } from "../constants";
import {
    TEST_BANK_V3,
    TEST_USERS_V3,
    TEST_TAN_METHODS_V3,
    TEST_ACCOUNTS_V3,
    buildTestMT940,
} from "./test-data";

/**
 * State of a dialog in the mock server.
 */
interface DialogState {
    dialogId: string;
    userId: string;
    authenticated: boolean;
    msgNo: number;
    systemId: string;
}

/**
 * A simulated FinTS 3.0 bank server for integration testing.
 *
 * Implements the `Connection` interface so it can be directly injected
 * into a `Dialog` or `PinTanClient` as the connection layer.
 *
 * Usage:
 * ```typescript
 * const server = new MockBankServerV3();
 * const dialog = new Dialog(config, server);
 * await dialog.sync();
 * ```
 */
export class MockBankServerV3 implements Connection {
    /** Active dialogs keyed by dialog ID. */
    private dialogs = new Map<string, DialogState>();
    /** Counter for generating dialog IDs. */
    private nextDialogId = 1000;
    /** Counter for generating system IDs. */
    private nextSystemId = 1;
    /** All received request strings (for test assertions). */
    public requestLog: string[] = [];
    /** All sent response strings (for test assertions). */
    public responseLog: string[] = [];

    /**
     * Create a v3.0 Connection that routes through this mock server.
     * Same as `this` since MockBankServerV3 implements Connection.
     */
    public createConnection(): Connection {
        return this;
    }

    /**
     * Reset the server state (clear all dialogs and logs).
     */
    public reset(): void {
        this.dialogs.clear();
        this.requestLog = [];
        this.responseLog = [];
        this.nextDialogId = 1000;
        this.nextSystemId = 1;
        // Reset user system IDs
        for (const user of Object.values(TEST_USERS_V3)) {
            user.systemId = "";
        }
    }

    /**
     * Process an incoming FinTS 3.0 request and return a response.
     * Implements the Connection interface.
     */
    public async send(request: Request): Promise<Response> {
        const requestStr = String(request);
        this.requestLog.push(requestStr);

        try {
            const responseStr = this.handleRequest(request);
            this.responseLog.push(responseStr);
            return new Response(responseStr);
        } catch (error) {
            const errorResponse = this.buildErrorResponse(
                String(request.dialogId || "0"),
                request.msgNo || 1,
                "9010",
                `Verarbeitung nicht möglich: ${(error as Error).message}`,
            );
            this.responseLog.push(errorResponse);
            return new Response(errorResponse);
        }
    }

    /**
     * Process the request and build a raw FinTS 3.0 response string.
     */
    private handleRequest(request: Request): string {
        // Extract segment types from the request
        const segmentTypes = request.segments.map((s) => s.type);
        const userId = request.name;
        const pin = request.pin;
        const dialogId = request.dialogId || "0";
        const msgNo = request.msgNo || 1;

        // Authenticate
        const authError = this.authenticate(userId, pin);

        if (segmentTypes.includes("HKSYN")) {
            if (authError) return authError;
            return this.handleSync(userId, dialogId, msgNo);
        }

        if (segmentTypes.includes("HKEND")) {
            return this.handleDialogEnd(dialogId, msgNo);
        }

        // For any other request, check if we have an auth error from the initial request
        if (segmentTypes.includes("HKIDN") && !segmentTypes.includes("HKSYN")) {
            if (authError) return authError;
            return this.handleDialogInit(userId, dialogId, msgNo);
        }

        if (segmentTypes.includes("HKSPA")) {
            return this.handleAccountList(dialogId, msgNo);
        }

        if (segmentTypes.includes("HKSAL")) {
            const hksal = request.segments.find((s) => s.type === "HKSAL");
            return this.handleBalance(dialogId, msgNo, hksal);
        }

        if (segmentTypes.includes("HKKAZ")) {
            const hkkaz = request.segments.find((s) => s.type === "HKKAZ");
            return this.handleStatements(dialogId, msgNo, hkkaz);
        }

        return this.buildErrorResponse(dialogId, msgNo, "9010", "Unbekannter Geschäftsvorfall");
    }

    // -----------------------------------------------------------------------
    // Request handlers
    // -----------------------------------------------------------------------

    private handleSync(userId: string, _dialogId: string, msgNo: number): string {
        const newDialogId = `SYN-${this.nextDialogId++}`;
        const systemId = `SYS${String(this.nextSystemId++).padStart(10, "0")}`;

        // Store system ID for this user
        if (TEST_USERS_V3[userId]) {
            TEST_USERS_V3[userId].systemId = systemId;
        }

        this.dialogs.set(newDialogId, {
            dialogId: newDialogId,
            userId,
            authenticated: true,
            msgNo: msgNo + 1,
            systemId,
        });

        const innerSegments = [
            // HNSHK (signature header)
            this.buildSegment("HNSHK", 2, 4, [
                `PIN:1`, `999`, `1`, `1`, `1`, `2::0`, `1`, `1:19700101:000000`, `1:999:1`, `6:10:16`,
                `${TEST_BANK_V3.countryCode}:${TEST_BANK_V3.blz}:${TEST_BANK_V3.bankName}:S:0:0`,
            ]),
            // HIRMG (message return codes)
            this.buildSegment("HIRMG", 3, 2, [
                `0010::Nachricht entgegengenommen`,
                `0020::Auftrag ausgefuehrt`,
            ]),
            // HIRMS (segment return codes)
            this.buildSegment("HIRMS", 4, 2, [
                `3920::Zugelassene TAN-Verfahren fur den Benutzer:${TEST_TAN_METHODS_V3.map((m) => m.securityFunction).join(":")}`,
                `0020::Synchronisierung durchgefuehrt`,
            ]),
            // HISYN (system ID)
            this.buildSegment("HISYN", 5, 4, [systemId]),
            // HIBPA (bank parameter data)
            this.buildBPASegment(6),
            // HISPAS (SEPA account parameter)
            this.buildSegment("HISPAS", 7, 1, [
                `1`, `1`, `1`,
                `urn?:iso?:std?:iso?:20022?:tech?:xsd?:pain.001.003.03`,
                `urn?:iso?:std?:iso?:20022?:tech?:xsd?:pain.002.003.03`,
            ]),
            // HISALS (balance parameter)
            this.buildSegment("HISALS", 8, 7, [`1`, `1`]),
            // HIKAZS (statement parameter)
            this.buildSegment("HIKAZS", 9, 7, [`1`, `1`, `365`, `J`]),
            // HITANS (TAN methods)
            this.buildTanMethodsSegment(10),
            // HIUPD (user data)
            ...this.buildHIUPDSegments(11, userId),
            // HNSHA (signature end)
            this.buildSegment("HNSHA", 99, 2, [`2`, ``, ``, ``]),
        ];

        return this.wrapResponse(newDialogId, msgNo, innerSegments);
    }

    private handleDialogInit(userId: string, _dialogId: string, msgNo: number): string {
        const newDialogId = `DLG-${this.nextDialogId++}`;

        this.dialogs.set(newDialogId, {
            dialogId: newDialogId,
            userId,
            authenticated: true,
            msgNo: msgNo + 1,
            systemId: TEST_USERS_V3[userId]?.systemId || "0",
        });

        const innerSegments = [
            this.buildSegment("HNSHK", 2, 4, [
                `PIN:1`, `999`, `1`, `1`, `1`, `2::0`, `1`, `1:19700101:000000`, `1:999:1`, `6:10:16`,
                `${TEST_BANK_V3.countryCode}:${TEST_BANK_V3.blz}:${TEST_BANK_V3.bankName}:S:0:0`,
            ]),
            this.buildSegment("HIRMG", 3, 2, [
                `0010::Nachricht entgegengenommen`,
            ]),
            this.buildSegment("HIRMS", 4, 2, [
                `0020::Auftrag ausgefuehrt`,
            ]),
            this.buildSegment("HNSHA", 5, 2, [`2`, ``, ``, ``]),
        ];

        return this.wrapResponse(newDialogId, msgNo, innerSegments);
    }

    private handleDialogEnd(dialogId: string, msgNo: number): string {
        this.dialogs.delete(dialogId);

        const innerSegments = [
            this.buildSegment("HNSHK", 2, 4, [
                `PIN:1`, `999`, `1`, `1`, `1`, `2::0`, `1`, `1:19700101:000000`, `1:999:1`, `6:10:16`,
                `${TEST_BANK_V3.countryCode}:${TEST_BANK_V3.blz}:${TEST_BANK_V3.bankName}:S:0:0`,
            ]),
            this.buildSegment("HIRMG", 3, 2, [
                `0010::Nachricht entgegengenommen`,
            ]),
            this.buildSegment("HIRMS", 4, 2, [
                `0100::Dialog beendet`,
            ]),
            this.buildSegment("HNSHA", 5, 2, [`2`, ``, ``, ``]),
        ];

        return this.wrapResponse(dialogId, msgNo, innerSegments);
    }

    private handleAccountList(dialogId: string, msgNo: number): string {
        const innerSegments = [
            this.buildSegment("HNSHK", 2, 4, [
                `PIN:1`, `999`, `1`, `1`, `1`, `2::0`, `1`, `1:19700101:000000`, `1:999:1`, `6:10:16`,
                `${TEST_BANK_V3.countryCode}:${TEST_BANK_V3.blz}:${TEST_BANK_V3.bankName}:S:0:0`,
            ]),
            this.buildSegment("HIRMG", 3, 2, [
                `0010::Nachricht entgegengenommen`,
            ]),
            this.buildSegment("HIRMS", 4, 2, [
                `0020::Auftrag ausgefuehrt`,
            ]),
            ...this.buildHISPASegments(5),
            this.buildSegment("HNSHA", 99, 2, [`2`, ``, ``, ``]),
        ];

        return this.wrapResponse(dialogId, msgNo, innerSegments);
    }

    private handleBalance(dialogId: string, msgNo: number, _segment: any): string {
        const innerSegments = [
            this.buildSegment("HNSHK", 2, 4, [
                `PIN:1`, `999`, `1`, `1`, `1`, `2::0`, `1`, `1:19700101:000000`, `1:999:1`, `6:10:16`,
                `${TEST_BANK_V3.countryCode}:${TEST_BANK_V3.blz}:${TEST_BANK_V3.bankName}:S:0:0`,
            ]),
            this.buildSegment("HIRMG", 3, 2, [
                `0010::Nachricht entgegengenommen`,
            ]),
            this.buildSegment("HIRMS", 4, 2, [
                `0020::Kontosaldo ermittelt`,
            ]),
            this.buildHISALSegment(5),
            this.buildSegment("HNSHA", 6, 2, [`2`, ``, ``, ``]),
        ];

        return this.wrapResponse(dialogId, msgNo, innerSegments);
    }

    private handleStatements(dialogId: string, msgNo: number, _segment: any): string {
        const account = TEST_ACCOUNTS_V3[0];
        const mt940 = buildTestMT940(account.accountNumber, account.blz, account.currency);

        const innerSegments = [
            this.buildSegment("HNSHK", 2, 4, [
                `PIN:1`, `999`, `1`, `1`, `1`, `2::0`, `1`, `1:19700101:000000`, `1:999:1`, `6:10:16`,
                `${TEST_BANK_V3.countryCode}:${TEST_BANK_V3.blz}:${TEST_BANK_V3.bankName}:S:0:0`,
            ]),
            this.buildSegment("HIRMG", 3, 2, [
                `0010::Nachricht entgegengenommen`,
            ]),
            this.buildSegment("HIRMS", 4, 2, [
                `0020::Auftrag ausgefuehrt`,
            ]),
            this.buildHIKAZSegment(5, mt940),
            this.buildSegment("HNSHA", 6, 2, [`2`, ``, ``, ``]),
        ];

        return this.wrapResponse(dialogId, msgNo, innerSegments);
    }

    // -----------------------------------------------------------------------
    // Helper methods
    // -----------------------------------------------------------------------

    private authenticate(userId: string, pin: string): string | null {
        const user = TEST_USERS_V3[userId];
        if (!user) {
            return this.buildErrorResponse("0", 1, "9931", "Zugang gesperrt - Benutzer unbekannt");
        }
        if (pin !== user.pin) {
            return this.buildErrorResponse("0", 1, "9340", "PIN ungueltig");
        }
        return null;
    }

    /**
     * Build a single FinTS 3.0 segment string.
     * Format: TYPE:SEGNO:VERSION+field1+field2'
     */
    private buildSegment(type: string, segNo: number, version: number, fields: string[]): string {
        return `${type}:${segNo}:${version}+${fields.join("+")}` + "'";
    }

    /**
     * Wrap inner segments into a complete FinTS 3.0 response message.
     */
    private wrapResponse(dialogId: string, msgNo: number, innerSegments: string[]): string {
        const innerContent = innerSegments.join("");

        // Build HNVSD wrapper
        const hnvsd = `HNVSD:999:1+@${innerContent.length}@${innerContent}'`;

        // Build HNVSK
        const hnvsk = `HNVSK:998:3+PIN:1+998+1+1::0+1:19700101:000000+2:2:13:@8@00000000:5:1+${TEST_BANK_V3.countryCode}:${TEST_BANK_V3.blz}:${TEST_BANK_V3.bankName}:V:0:0+0'`;

        // Build HNHBS
        const hnhbs = `HNHBS:${innerSegments.length + 3}:1+${msgNo}'`;

        // Calculate total length for HNHBK
        const segmentsWithoutHeader = hnvsk + hnvsd + hnhbs;
        const totalLength = HEADER_LENGTH + dialogId.length + String(msgNo).length + segmentsWithoutHeader.length;

        // Build HNHBK
        const hnhbk = `HNHBK:1:3+${String(totalLength).padStart(12, "0")}+${TEST_BANK_V3.hbciVersion}+${dialogId}+${msgNo}'`;

        return hnhbk + hnvsk + hnvsd + hnhbs;
    }

    private buildErrorResponse(dialogId: string, msgNo: number, code: string, message: string): string {
        const innerSegments = [
            this.buildSegment("HNSHK", 2, 4, [
                `PIN:1`, `999`, `1`, `1`, `1`, `2::0`, `1`, `1:19700101:000000`, `1:999:1`, `6:10:16`,
                `${TEST_BANK_V3.countryCode}:${TEST_BANK_V3.blz}:${TEST_BANK_V3.bankName}:S:0:0`,
            ]),
            this.buildSegment("HIRMG", 3, 2, [
                `${code}::${message}`,
            ]),
            this.buildSegment("HNSHA", 4, 2, [`2`, ``, ``, ``]),
        ];

        return this.wrapResponse(dialogId, msgNo, innerSegments);
    }

    private buildBPASegment(segNo: number): string {
        return this.buildSegment("HIBPA", segNo, 3, [
            `${TEST_BANK_V3.bpdVersion}`,
            `${TEST_BANK_V3.countryCode}:${TEST_BANK_V3.blz}`,
            `${TEST_BANK_V3.bankName}`,
            `3`,   // Number of languages
            `1`,   // Default language
            `3`,   // Number of HBCI versions
            `${TEST_BANK_V3.hbciVersion}`,
            `0`,   // Max message size
        ]);
    }

    private buildTanMethodsSegment(segNo: number): string {
        // HITANS v7 format (FinTS 3.0 spec §C.4):
        // maxRequests+minSignatures+securityClass+oneStepAllowed:multiple:securityProfile:method1_fields...:method2_fields...'
        //
        // All TAN method data goes into a SINGLE '+'-field (DEG), separated by ':'.
        // Per-method field order for v7 (tanMethodArgumentMap v7, 30 fields):
        //   securityFunction, tanProcess, techId, zkaId, zkaVersion, name,
        //   maxLengthInput, allowedFormat, textReturnvalue, maxLengthReturnvalue,
        //   numberOfSupportedLists, multiple, tanTimeDialogAssociation,
        //   tanDialogOptions, tanListNumberRequired, cancellable,
        //   smsChargeAccountRequired, principalAccountRequired,
        //   challengeClassRequired, challengeValueRequired, challengeStructured,
        //   initializationMode, supportedMediaNumber, hhdUcRequired,
        //   activeTanMedia, decoupledMaxStatusRequests,
        //   decoupledWaitBeforeFirstStatusRequest, decoupledWaitBetweenStatusRequests,
        //   decoupledManualConfirmationAllowed, decoupledAutoConfirmationAllowed
        const methodFields = TEST_TAN_METHODS_V3.map((m) =>
            [
                m.securityFunction,   // 1 securityFunction
                m.tanProcess,         // 2 tanProcess
                m.techId,             // 3 techId
                "",                   // 4 zkaId
                "",                   // 5 zkaVersion
                m.name,               // 6 name
                m.maxLengthInput,     // 7 maxLengthInput
                m.allowedFormat,      // 8 allowedFormat
                "",                   // 9 textReturnvalue
                m.maxLengthInput,     // 10 maxLengthReturnvalue
                "1",                  // 11 numberOfSupportedLists
                "J",                  // 12 multiple
                "1",                  // 13 tanTimeDialogAssociation
                "0",                  // 14 tanDialogOptions
                "N",                  // 15 tanListNumberRequired
                "J",                  // 16 cancellable
                "N",                  // 17 smsChargeAccountRequired
                "N",                  // 18 principalAccountRequired
                "N",                  // 19 challengeClassRequired
                "N",                  // 20 challengeValueRequired
                "N",                  // 21 challengeStructured
                "00",                 // 22 initializationMode
                "1",                  // 23 supportedMediaNumber
                "N",                  // 24 hhdUcRequired
                "0",                  // 25 activeTanMedia
                m.numStatusRequests,  // 26 decoupledMaxStatusRequests
                m.firstDelaySeconds,  // 27 decoupledWaitBeforeFirstStatusRequest
                m.delayBetweenSeconds, // 28 decoupledWaitBetweenStatusRequests
                "N",                  // 29 decoupledManualConfirmationAllowed
                "N",                  // 30 decoupledAutoConfirmationAllowed
            ].join(":")
        ).join(":");

        // The 4th DEG: oneStepAllowed:multiple:securityProfile:<all method fields>
        const tanDeg = `J:N:900:${methodFields}`;

        return this.buildSegment("HITANS", segNo, 7, [
            `1`, `1`, `1`, tanDeg,
        ]);
    }

    private buildHIUPDSegments(startSegNo: number, userId: string): string[] {
        const user = TEST_USERS_V3[userId];
        return TEST_ACCOUNTS_V3.map((acc, i) => {
            const segNo = startSegNo + i;
            return this.buildSegment("HIUPD", segNo, 6, [
                `${acc.accountType}::${TEST_BANK_V3.countryCode}:${acc.blz}:${acc.accountNumber}`,
                acc.iban,
                userId,
                `${acc.accountType}`,
                acc.currency,
                user?.name || "",
                ``,  // account limit
                ``,  // extension
                `HKSPA:1+HKSAL:1+HKKAZ:1`,  // allowed transactions
            ]);
        });
    }

    private buildHISPASegments(startSegNo: number): string[] {
        return TEST_ACCOUNTS_V3.map((acc, i) => {
            const segNo = startSegNo + i;
            return this.buildSegment("HISPA", segNo, 1, [
                `J:${acc.iban}:${acc.bic}:${acc.accountNumber}:${acc.subAccount}:${TEST_BANK_V3.countryCode}:${acc.blz}`,
            ]);
        });
    }

    private buildHISALSegment(segNo: number): string {
        const account = TEST_ACCOUNTS_V3[0];
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");

        return this.buildSegment("HISAL", segNo, 7, [
            `${account.accountType}::${TEST_BANK_V3.countryCode}:${account.blz}:${account.accountNumber}`,
            account.accountNumber,
            account.currency,
            `C:13095,67:EUR:${dateStr}`,   // Booked balance
            `C:13095,67:EUR:${dateStr}`,   // Available balance (same)
            `5000,00:EUR`,                  // Credit limit
        ]);
    }

    private buildHIKAZSegment(segNo: number, mt940Data: string): string {
        // HIKAZ wraps MT940 data using @length@ binary notation
        return `HIKAZ:${segNo}:7:4+@${mt940Data.length}@${mt940Data}'`;
    }
}
