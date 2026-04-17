import { FinTS4Client } from "../client";
import { FINTS_NAMESPACE } from "../constants";

// Mock fetch for HTTP connection tests
const originalFetch = globalThis.fetch;

function mockFetch(responses: string[]) {
    let callIndex = 0;
    globalThis.fetch = jest.fn().mockImplementation(async () => {
        if (callIndex >= responses.length) {
            throw new Error("No more mock responses available");
        }
        const text = responses[callIndex++];
        return {
            ok: true,
            status: 200,
            text: async () => text,
        };
    });
}

afterEach(() => {
    globalThis.fetch = originalFetch;
});

function buildSyncResponse(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
        <FinTSMessage xmlns="${FINTS_NAMESPACE}">
            <MsgHead><MsgNo>1</MsgNo><DialogID>sync-d1</DialogID></MsgHead>
            <MsgBody>
                <ReturnValue><Code>0010</Code><Message>OK</Message></ReturnValue>
                <Segment>
                    <SegHead><Type>SyncRes</Type><Version>1</Version><SegNo>1</SegNo></SegHead>
                    <SegBody><SystemID>sys-1</SystemID></SegBody>
                </Segment>
                <Segment>
                    <SegHead><Type>BPD</Type><Version>1</Version><SegNo>2</SegNo></SegHead>
                    <SegBody><BPD><BankName>Test Bank</BankName></BPD></SegBody>
                </Segment>
                <Segment>
                    <SegHead><Type>Balance</Type><Version>2</Version><SegNo>3</SegNo></SegHead>
                    <SegBody></SegBody>
                </Segment>
                <Segment>
                    <SegHead><Type>AccountStatement</Type><Version>1</Version><SegNo>4</SegNo></SegHead>
                    <SegBody></SegBody>
                </Segment>
                <Segment>
                    <SegHead><Type>Holdings</Type><Version>6</Version><SegNo>5</SegNo></SegHead>
                    <SegBody></SegBody>
                </Segment>
            </MsgBody>
            <MsgTail><MsgNo>1</MsgNo></MsgTail>
        </FinTSMessage>`;
}

function buildSyncResponseWithoutHoldings(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
        <FinTSMessage xmlns="${FINTS_NAMESPACE}">
            <MsgHead><MsgNo>1</MsgNo><DialogID>sync-d1</DialogID></MsgHead>
            <MsgBody>
                <ReturnValue><Code>0010</Code><Message>OK</Message></ReturnValue>
                <Segment>
                    <SegHead><Type>SyncRes</Type><Version>1</Version><SegNo>1</SegNo></SegHead>
                    <SegBody><SystemID>sys-1</SystemID></SegBody>
                </Segment>
                <Segment>
                    <SegHead><Type>BPD</Type><Version>1</Version><SegNo>2</SegNo></SegHead>
                    <SegBody><BPD><BankName>Test Bank</BankName></BPD></SegBody>
                </Segment>
                <Segment>
                    <SegHead><Type>Balance</Type><Version>2</Version><SegNo>3</SegNo></SegHead>
                    <SegBody></SegBody>
                </Segment>
                <Segment>
                    <SegHead><Type>AccountStatement</Type><Version>1</Version><SegNo>4</SegNo></SegHead>
                    <SegBody></SegBody>
                </Segment>
            </MsgBody>
            <MsgTail><MsgNo>1</MsgNo></MsgTail>
        </FinTSMessage>`;
}

function buildOkResponse(dialogId = "d1", extra = ""): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
        <FinTSMessage xmlns="${FINTS_NAMESPACE}">
            <MsgHead><MsgNo>1</MsgNo><DialogID>${dialogId}</DialogID></MsgHead>
            <MsgBody>
                <ReturnValue><Code>0010</Code><Message>OK</Message></ReturnValue>
                ${extra}
            </MsgBody>
            <MsgTail><MsgNo>1</MsgNo></MsgTail>
        </FinTSMessage>`;
}

function buildAccountListResponse(): string {
    return buildOkResponse(
        "acct-d1",
        `<Segment>
            <SegHead><Type>AccountList</Type><Version>1</Version><SegNo>3</SegNo></SegHead>
            <SegBody>
                <Account>
                    <IBAN>DE89370400440532013000</IBAN>
                    <BIC>COBADEFFXXX</BIC>
                    <AccountNumber>0532013000</AccountNumber>
                    <BLZ>37040044</BLZ>
                    <OwnerName>Max Mustermann</OwnerName>
                </Account>
            </SegBody>
        </Segment>`,
    );
}

function buildStatementsResponse(): string {
    const camtData = `&lt;?xml version=&quot;1.0&quot;?&gt;&lt;Document&gt;&lt;BkToCstmrStmt&gt;&lt;Stmt&gt;&lt;Id&gt;S1&lt;/Id&gt;&lt;Ntry&gt;&lt;Amt Ccy=&quot;EUR&quot;&gt;100.00&lt;/Amt&gt;&lt;CdtDbtInd&gt;CRDT&lt;/CdtDbtInd&gt;&lt;/Ntry&gt;&lt;/Stmt&gt;&lt;/BkToCstmrStmt&gt;&lt;/Document&gt;`;
    return buildOkResponse(
        "stmt-d1",
        `<Segment>
            <SegHead><Type>AccountStatement</Type><Version>1</Version><SegNo>3</SegNo></SegHead>
            <SegBody>
                <CamtData>${camtData}</CamtData>
            </SegBody>
        </Segment>`,
    );
}

function buildHoldingsResponse(): string {
    const mt535Data = `:16R:FIN
:35B:ISIN LU0000000001
/DE/TEST01
Testfonds A
:90B::MRKT//ACTU/EUR100,50
:98A::PRIC//20240101
:93B::AGGR//UNIT/10,0000
:19A::HOLD//EUR1005,00
:16S:FIN
-`;
    // Escape the MT535 data for embedding in XML
    const escapedMt535 = mt535Data
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    return buildOkResponse(
        "hold-d1",
        `<Segment>
            <SegHead><Type>Holdings</Type><Version>6</Version><SegNo>3</SegNo></SegHead>
            <SegBody>
                <Mt535Data>${escapedMt535}</Mt535Data>
            </SegBody>
        </Segment>`,
    );
}

const clientConfig = {
    blz: "12345678",
    name: "testuser",
    pin: "12345",
    url: "https://banking.example.com/fints",
};

describe("FinTS4Client", () => {
    describe("createDialog", () => {
        it("creates a dialog with the correct config", () => {
            const client = new FinTS4Client(clientConfig);
            const dialog = client.createDialog();

            expect(dialog.blz).toBe("12345678");
            expect(dialog.name).toBe("testuser");
        });
    });

    describe("capabilities", () => {
        it("retrieves bank capabilities", async () => {
            mockFetch([
                buildSyncResponse(), // sync
                buildOkResponse("0"), // end sync dialog
            ]);

            const client = new FinTS4Client(clientConfig);
            const caps = await client.capabilities();

            expect(caps.supportsAccounts).toBe(true);
            expect(caps.supportsBalance).toBe(true);
            expect(caps.supportsTransactions).toBe(true);
        });
    });

    describe("accounts", () => {
        it("fetches account list", async () => {
            mockFetch([
                buildSyncResponse(), // sync
                buildOkResponse("0"), // end sync dialog
                buildOkResponse("init-d1"), // init
                buildAccountListResponse(), // account list
                buildOkResponse("0"), // end dialog
            ]);

            const client = new FinTS4Client(clientConfig);
            const accounts = await client.accounts();

            expect(accounts.length).toBe(1);
            expect(accounts[0].iban).toBe("DE89370400440532013000");
            expect(accounts[0].bic).toBe("COBADEFFXXX");
            expect(accounts[0].accountOwnerName).toBe("Max Mustermann");
        });
    });

    describe("balance", () => {
        it("returns default balance when no balance data returned", async () => {
            mockFetch([
                buildSyncResponse(), // sync
                buildOkResponse("0"), // end sync dialog
                buildOkResponse("init-d1"), // init
                buildOkResponse("bal-d1"), // balance (no data)
                buildOkResponse("0"), // end dialog
            ]);

            const client = new FinTS4Client(clientConfig);
            const account = {
                iban: "DE89370400440532013000",
                bic: "COBADEFFXXX",
                accountNumber: "0532013000",
                blz: "37040044",
            };
            const balance = await client.balance(account);

            expect(balance.account).toEqual(account);
            expect(balance.availableBalance).toBe(0);
            expect(balance.currency).toBe("EUR");
        });
    });

    describe("camtStatements", () => {
        it("fetches and parses camt statements", async () => {
            mockFetch([
                buildSyncResponse(), // sync
                buildOkResponse("0"), // end sync dialog
                buildOkResponse("init-d1"), // init
                buildStatementsResponse(), // statements
                buildOkResponse("0"), // end dialog
            ]);

            const client = new FinTS4Client(clientConfig);
            const account = {
                iban: "DE89370400440532013000",
                bic: "COBADEFFXXX",
                accountNumber: "0532013000",
                blz: "37040044",
            };
            const statements = await client.camtStatements(account);

            expect(statements.length).toBe(1);
            expect(statements[0].id).toBe("S1");
            expect(statements[0].entries.length).toBe(1);
            expect(statements[0].entries[0].amount).toBe(100.0);
        });
    });

    describe("statements", () => {
        it("converts camt to Statement format", async () => {
            mockFetch([
                buildSyncResponse(), // sync
                buildOkResponse("0"), // end sync
                buildOkResponse("init-d1"), // init
                buildStatementsResponse(), // statements
                buildOkResponse("0"), // end dialog
            ]);

            const client = new FinTS4Client(clientConfig);
            const account = {
                iban: "DE89370400440532013000",
                bic: "COBADEFFXXX",
                accountNumber: "0532013000",
                blz: "37040044",
            };
            const statements = await client.statements(account);

            expect(statements.length).toBe(1);
            expect(statements[0].referenceNumber).toBe("S1");
            expect(statements[0].transactions.length).toBe(1);
            expect(statements[0].transactions[0].amount).toBe(100.0);
            expect(statements[0].transactions[0].isCredit).toBe(true);
        });
    });

    describe("holdings", () => {
        it("fetches and parses MT535 holdings", async () => {
            mockFetch([
                buildSyncResponse(), // sync (with Holdings capability)
                buildOkResponse("0"), // end sync dialog
                buildOkResponse("init-d1"), // init
                buildHoldingsResponse(), // holdings
                buildOkResponse("0"), // end dialog
            ]);

            const client = new FinTS4Client(clientConfig);
            const account = {
                iban: "DE89370400440532013000",
                bic: "COBADEFFXXX",
                accountNumber: "0532013000",
                blz: "37040044",
            };
            const holdings = await client.holdings(account);

            expect(holdings.length).toBe(1);
            expect(holdings[0].isin).toBe("LU0000000001");
            expect(holdings[0].name).toBe("Testfonds A");
            expect(holdings[0].marketPrice).toBe(100.5);
            expect(holdings[0].pieces).toBe(10);
            expect(holdings[0].totalValue).toBe(1005);
        });

        it("throws when holdings are not supported by the bank", async () => {
            mockFetch([
                buildSyncResponseWithoutHoldings(), // sync (without Holdings capability)
                buildOkResponse("0"), // end sync dialog
            ]);

            const client = new FinTS4Client(clientConfig);
            const account = {
                iban: "DE89370400440532013000",
                bic: "COBADEFFXXX",
                accountNumber: "0532013000",
                blz: "37040044",
            };
            await expect(client.holdings(account)).rejects.toThrow("Holdings are not supported by this bank.");
        });
    });
});
