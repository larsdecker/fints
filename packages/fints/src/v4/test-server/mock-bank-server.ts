/**
 * FinTS 4.1 Mock Bank Server
 *
 * A simulated FinTS 4.1 server that accepts XML requests and returns
 * realistic XML responses with test data. Designed for integration testing
 * of the FinTS 4.1 client without requiring a real bank connection.
 *
 * Features:
 * - Full dialog lifecycle support (Sync → Init → Business → End)
 * - PIN/TAN authentication validation
 * - Account listing, balance queries, account statements (camt.053)
 * - Realistic return codes per FinTS 4.1 specification
 * - Pagination support via touchdown tokens
 * - Error simulation (invalid PIN, unknown account, etc.)
 *
 * Usage in tests:
 * ```typescript
 * const server = new MockBankServer();
 * const client = new FinTS4Client({
 *   blz: "76050101",
 *   name: "testuser",
 *   pin: "12345",
 *   url: "http://mock", // irrelevant – we inject the connection
 * });
 * // Use server.createConnection() as the mock connection
 * ```
 */
import { XMLParser } from "fast-xml-parser";
import { FinTS4Connection } from "../types";
import { FINTS_NAMESPACE, FINTS_VERSION, COUNTRY_CODE } from "../constants";
import {
    TEST_BANK,
    TEST_USERS,
    TEST_TAN_METHODS,
    TEST_ACCOUNTS,
    TEST_SEGMENT_CAPABILITIES,
    buildTestCamt053,
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
 * A simulated FinTS 4.1 bank server for integration testing.
 */
export class MockBankServer {
    /** Active dialogs keyed by dialog ID. */
    private dialogs = new Map<string, DialogState>();
    /** Counter for generating dialog IDs. */
    private nextDialogId = 1000;
    /** Counter for generating system IDs. */
    private nextSystemId = 1;
    /** All received requests (for test assertions). */
    public requestLog: string[] = [];
    /** All sent responses (for test assertions). */
    public responseLog: string[] = [];

    private parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        parseAttributeValue: false,
        parseTagValue: false,
        trimValues: true,
        isArray: (name: string) => ["Segment", "ReturnValue"].includes(name),
    });

    /**
     * Create a FinTS4Connection that routes requests through this mock server.
     */
    public createConnection(): FinTS4Connection {
        return {
            send: async (xmlRequest: string) => this.handleRequest(xmlRequest),
        };
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
    }

    /**
     * Process an incoming FinTS 4.1 XML request and return a response.
     */
    public async handleRequest(xmlRequest: string): Promise<string> {
        this.requestLog.push(xmlRequest);

        try {
            const parsed = this.parser.parse(xmlRequest);
            const msg = parsed.FinTSMessage || parsed;
            const msgHead = msg.MsgHead || {};
            const msgBody = msg.MsgBody || {};
            const msgNo = parseInt(String(msgHead.MsgNo || "1"), 10);
            const dialogId = String(msgHead.DialogID || "0");

            // Extract segments
            const segments = this.extractSegments(msgBody);

            // Extract credentials from security envelope
            const credentials = this.extractCredentials(msgBody);

            // Determine the type of request from the first business segment
            const segmentTypes = segments.map((s) => s.type);
            let response: string;

            if (segmentTypes.includes("DialogInit") && segmentTypes.includes("Sync")) {
                response = this.handleSync(msgNo, credentials);
            } else if (segmentTypes.includes("DialogInit")) {
                response = this.handleDialogInit(msgNo, dialogId, credentials);
            } else if (segmentTypes.includes("DialogEnd")) {
                response = this.handleDialogEnd(msgNo, dialogId);
            } else if (segmentTypes.includes("AccountList")) {
                response = this.handleAccountList(msgNo, dialogId);
            } else if (segmentTypes.includes("Balance")) {
                const balSeg = segments.find((s) => s.type === "Balance");
                response = this.handleBalance(msgNo, dialogId, balSeg?.body);
            } else if (segmentTypes.includes("AccountStatement")) {
                const stmtSeg = segments.find((s) => s.type === "AccountStatement");
                response = this.handleAccountStatement(msgNo, dialogId, stmtSeg?.body);
            } else {
                response = this.buildErrorResponse(msgNo, dialogId, "9010", "Unbekannter Geschäftsvorfall");
            }

            this.responseLog.push(response);
            return response;
        } catch (error) {
            const errorResponse = this.buildErrorResponse(
                1,
                "0",
                "9010",
                `Verarbeitung nicht möglich: ${(error as Error).message}`,
            );
            this.responseLog.push(errorResponse);
            return errorResponse;
        }
    }

    // -----------------------------------------------------------------------
    // Request handlers
    // -----------------------------------------------------------------------

    private handleSync(msgNo: number, credentials: { userId: string; pin: string }): string {
        // Validate credentials
        const authError = this.authenticate(credentials);
        if (authError) return authError;

        const dialogId = `sync-${this.nextDialogId++}`;
        const systemId = `SYS-${String(this.nextSystemId++).padStart(10, "0")}`;

        // Store the system ID for the user
        if (TEST_USERS[credentials.userId]) {
            TEST_USERS[credentials.userId].systemId = systemId;
        }

        this.dialogs.set(dialogId, {
            dialogId,
            userId: credentials.userId,
            authenticated: true,
            msgNo: msgNo + 1,
            systemId,
        });

        const returnValues =
            this.buildReturnValue("0010", "Nachricht entgegengenommen") +
            this.buildReturnValue("3920", "Zugelassene TAN-Verfahren für den Benutzer", "912") +
            this.buildReturnValue("3920", "Zugelassene TAN-Verfahren für den Benutzer", "913");

        const syncSegment = this.buildSegment("SyncRes", 1, 1, `<SystemID>${systemId}</SystemID>`);
        const bpdSegment = this.buildBpdSegment(2);
        const updSegment = this.buildUpdSegment(3, credentials.userId);
        const tanMethodsSegment = this.buildTanMethodsSegment(4);
        const capSegments = TEST_SEGMENT_CAPABILITIES.map((cap, i) =>
            this.buildSegment(cap.type, cap.version, 5 + i, ""),
        ).join("\n");

        return this.buildResponse(
            msgNo,
            dialogId,
            `${returnValues}${syncSegment}${bpdSegment}${updSegment}${tanMethodsSegment}${capSegments}`,
        );
    }

    private handleDialogInit(
        msgNo: number,
        _requestDialogId: string,
        credentials: { userId: string; pin: string },
    ): string {
        const authError = this.authenticate(credentials);
        if (authError) return authError;

        const dialogId = `DLG-${this.nextDialogId++}`;
        this.dialogs.set(dialogId, {
            dialogId,
            userId: credentials.userId,
            authenticated: true,
            msgNo: msgNo + 1,
            systemId: TEST_USERS[credentials.userId]?.systemId || "0",
        });

        return this.buildResponse(
            msgNo,
            dialogId,
            this.buildReturnValue("0010", "Nachricht entgegengenommen") +
                this.buildReturnValue("0020", "Auftrag ausgeführt"),
        );
    }

    private handleDialogEnd(msgNo: number, dialogId: string): string {
        this.dialogs.delete(dialogId);

        return this.buildResponse(msgNo, "0", this.buildReturnValue("0100", "Dialog beendet"));
    }

    private handleAccountList(msgNo: number, dialogId: string): string {
        const dialog = this.dialogs.get(dialogId);
        if (!dialog) {
            return this.buildErrorResponse(msgNo, dialogId, "9800", "Dialogkontext ungültig");
        }

        const accountsXml = TEST_ACCOUNTS.map(
            (acc) => `
                <Account>
                    <IBAN>${acc.iban}</IBAN>
                    <BIC>${acc.bic}</BIC>
                    <AccountNumber>${acc.accountNumber}</AccountNumber>
                    <BLZ>${acc.blz}</BLZ>
                    <OwnerName>${acc.ownerName}</OwnerName>
                    <AccountName>${acc.accountName}</AccountName>
                    <Currency>${acc.currency}</Currency>
                </Account>`,
        ).join("");

        const segBody = accountsXml;
        const accountSeg = this.buildSegment("AccountList", 1, 3, segBody);

        return this.buildResponse(
            msgNo,
            dialogId,
            this.buildReturnValue("0010", "Nachricht entgegengenommen") +
                this.buildReturnValue("0020", "Auftrag ausgeführt") +
                accountSeg,
        );
    }

    private handleBalance(msgNo: number, dialogId: string, body?: Record<string, unknown>): string {
        const dialog = this.dialogs.get(dialogId);
        if (!dialog) {
            return this.buildErrorResponse(msgNo, dialogId, "9800", "Dialogkontext ungültig");
        }

        // Extract IBAN from the request
        const iban = this.extractIban(body);
        const account = TEST_ACCOUNTS.find((a) => a.iban === iban);
        if (!account) {
            return this.buildErrorResponse(msgNo, dialogId, "9010", `Konto ${iban || "unbekannt"} nicht gefunden`);
        }

        const balanceXml = `
            <BookedBalance>
                <Amount Ccy="${account.currency}">13095.67</Amount>
                <CdtDbtInd>CRDT</CdtDbtInd>
                <Date>${new Date().toISOString().slice(0, 10)}</Date>
            </BookedBalance>
            <AvailableBalance>
                <Amount Ccy="${account.currency}">13095.67</Amount>
                <CdtDbtInd>CRDT</CdtDbtInd>
                <Date>${new Date().toISOString().slice(0, 10)}</Date>
            </AvailableBalance>
            <CreditLimit Ccy="${account.currency}">5000.00</CreditLimit>
            <AccountName>${account.accountName}</AccountName>`;

        const balanceSeg = this.buildSegment("Balance", 7, 3, balanceXml);

        return this.buildResponse(
            msgNo,
            dialogId,
            this.buildReturnValue("0010", "Nachricht entgegengenommen") +
                this.buildReturnValue("0020", "Auftrag ausgeführt") +
                balanceSeg,
        );
    }

    private handleAccountStatement(msgNo: number, dialogId: string, body?: Record<string, unknown>): string {
        const dialog = this.dialogs.get(dialogId);
        if (!dialog) {
            return this.buildErrorResponse(msgNo, dialogId, "9800", "Dialogkontext ungültig");
        }

        const iban = this.extractIban(body);
        const account = TEST_ACCOUNTS.find((a) => a.iban === iban);
        if (!account) {
            return this.buildErrorResponse(msgNo, dialogId, "9010", `Konto ${iban || "unbekannt"} nicht gefunden`);
        }

        // Build camt.053 data
        const camtXml = buildTestCamt053(account.iban, account.currency);
        // Escape the camt XML for embedding in the FinTS response
        const escapedCamt = camtXml
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

        const stmtSeg = this.buildSegment("AccountStatement", 2, 3, `<CamtData>${escapedCamt}</CamtData>`);

        return this.buildResponse(
            msgNo,
            dialogId,
            this.buildReturnValue("0010", "Nachricht entgegengenommen") +
                this.buildReturnValue("0020", "Auftrag ausgeführt") +
                stmtSeg,
        );
    }

    // -----------------------------------------------------------------------
    // Helper methods
    // -----------------------------------------------------------------------

    private authenticate(credentials: { userId: string; pin: string }): string | null {
        const user = TEST_USERS[credentials.userId];
        if (!user) {
            return this.buildErrorResponse(1, "0", "9931", "Zugang gesperrt – Benutzer unbekannt");
        }
        if (credentials.pin !== user.pin) {
            return this.buildErrorResponse(1, "0", "9340", "PIN ungültig");
        }
        return null;
    }

    private extractSegments(
        msgBody: Record<string, unknown>,
    ): Array<{ type: string; version: number; body: Record<string, unknown> }> {
        const segments: Array<{ type: string; version: number; body: Record<string, unknown> }> = [];
        const rawSegments = msgBody.Segment;
        if (!rawSegments) return segments;

        const segArr = Array.isArray(rawSegments) ? rawSegments : [rawSegments];
        for (const seg of segArr) {
            const segObj = seg as Record<string, unknown>;
            const head = segObj.SegHead as Record<string, unknown> | undefined;
            if (head) {
                segments.push({
                    type: String(head.Type || ""),
                    version: parseInt(String(head.Version || "1"), 10),
                    body: (segObj.SegBody as Record<string, unknown>) || {},
                });
            }
        }
        return segments;
    }

    private extractCredentials(msgBody: Record<string, unknown>): { userId: string; pin: string } {
        const header = msgBody.SignatureHeader as Record<string, unknown> | undefined;
        const trailer = msgBody.SignatureTrailer as Record<string, unknown> | undefined;

        return {
            userId: String(header?.UserID || ""),
            pin: String(trailer?.PIN || ""),
        };
    }

    private extractIban(body?: Record<string, unknown>): string | undefined {
        if (!body) return undefined;
        const account = body.Account as Record<string, unknown> | undefined;
        return account ? String(account.IBAN || "") : undefined;
    }

    private buildResponse(msgNo: number, dialogId: string, bodyContent: string): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<FinTSMessage xmlns="${FINTS_NAMESPACE}">
    <MsgHead>
        <MsgNo>${msgNo}</MsgNo>
        <DialogID>${dialogId}</DialogID>
        <HBCIVersion>${FINTS_VERSION}</HBCIVersion>
        <Initiator>
            <BLZ>${TEST_BANK.blz}</BLZ>
            <CountryCode>${COUNTRY_CODE}</CountryCode>
        </Initiator>
    </MsgHead>
    <MsgBody>
        ${bodyContent}
    </MsgBody>
    <MsgTail><MsgNo>${msgNo}</MsgNo></MsgTail>
</FinTSMessage>`;
    }

    private buildErrorResponse(msgNo: number, dialogId: string, code: string, message: string): string {
        return this.buildResponse(msgNo, dialogId, this.buildReturnValue(code, message));
    }

    private buildReturnValue(code: string, message: string, parameter?: string): string {
        let xml = `<ReturnValue><Code>${code}</Code><Message>${this.escapeXml(message)}</Message>`;
        if (parameter) {
            xml += `<Parameter>${this.escapeXml(parameter)}</Parameter>`;
        }
        xml += `</ReturnValue>\n`;
        return xml;
    }

    private buildSegment(type: string, version: number, segNo: number, body: string): string {
        return `
        <Segment>
            <SegHead>
                <Type>${type}</Type>
                <Version>${version}</Version>
                <SegNo>${segNo}</SegNo>
            </SegHead>
            <SegBody>${body}</SegBody>
        </Segment>`;
    }

    private buildBpdSegment(segNo: number): string {
        const painFormats = TEST_BANK.painFormats.map((f) => `<PainFormat>${f}</PainFormat>`).join("");
        const camtFormats = TEST_BANK.camtFormats.map((f) => `<CamtFormat>${f}</CamtFormat>`).join("");

        return this.buildSegment(
            "BPD",
            1,
            segNo,
            `<BPD>
                <BankName>${this.escapeXml(TEST_BANK.bankName)}</BankName>
                <BPDVersion>${TEST_BANK.bpdVersion}</BPDVersion>
                <BIC>${TEST_BANK.bic}</BIC>
                <Version>${FINTS_VERSION}</Version>
                <Language>de</Language>
                <SecurityMethod>PIN_TAN</SecurityMethod>
                ${painFormats}
                ${camtFormats}
            </BPD>`,
        );
    }

    private buildUpdSegment(segNo: number, userId: string): string {
        const user = TEST_USERS[userId];
        const accounts = TEST_ACCOUNTS.map(
            (acc) => `
                <Account>
                    <IBAN>${acc.iban}</IBAN>
                    <BIC>${acc.bic}</BIC>
                    <OwnerName>${this.escapeXml(user?.name || "")}</OwnerName>
                    <AccountName>${this.escapeXml(acc.accountName)}</AccountName>
                    <Transaction>HKCAZ</Transaction>
                    <Transaction>HKSAL</Transaction>
                    <Transaction>HKSPA</Transaction>
                </Account>`,
        ).join("");

        return this.buildSegment(
            "UPD",
            1,
            segNo,
            `<UPD>
                <UPDVersion>${TEST_BANK.updVersion}</UPDVersion>
                ${accounts}
            </UPD>`,
        );
    }

    private buildTanMethodsSegment(segNo: number): string {
        const methods = TEST_TAN_METHODS.map(
            (m) => `
                <TANMethod>
                    <SecurityFunction>${m.securityFunction}</SecurityFunction>
                    <TANProcess>${m.tanProcess}</TANProcess>
                    <TechID>${m.techId}</TechID>
                    <Name>${this.escapeXml(m.name)}</Name>
                    <MaxLengthInput>${m.maxLengthInput}</MaxLengthInput>
                    <AllowedFormat>${m.allowedFormat}</AllowedFormat>
                    <Cancellable>${m.cancellable}</Cancellable>
                    ${m.decoupledMaxStatusRequests ? `<DecoupledMaxStatusRequests>${m.decoupledMaxStatusRequests}</DecoupledMaxStatusRequests>` : ""}
                    ${m.decoupledWaitBeforeFirstStatusRequest ? `<DecoupledWaitBeforeFirstStatusRequest>${m.decoupledWaitBeforeFirstStatusRequest}</DecoupledWaitBeforeFirstStatusRequest>` : ""}
                    ${m.decoupledWaitBetweenStatusRequests ? `<DecoupledWaitBetweenStatusRequests>${m.decoupledWaitBetweenStatusRequests}</DecoupledWaitBetweenStatusRequests>` : ""}
                </TANMethod>`,
        ).join("");

        return this.buildSegment("TANMethods", 7, segNo, methods);
    }

    private escapeXml(s: string): string {
        return s
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }
}
