/**
 * Tests for the NegotiatingClient covering the version negotiation
 * strategy and all method routing (v3.0 vs v4.1).
 */
import { NegotiatingClient } from "../../negotiating-client";
import { FinTS4Client } from "../client";
import { PinTanClient } from "../../pin-tan-client";
import { FINTS_NAMESPACE } from "../constants";

// Mock fetch
const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

function specSyncResponse(): string {
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
            </MsgBody>
            <MsgTail><MsgNo>1</MsgNo></MsgTail>
        </FinTSMessage>`;
}

function okResponse(dialogId = "d1"): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
        <FinTSMessage xmlns="${FINTS_NAMESPACE}">
            <MsgHead><MsgNo>1</MsgNo><DialogID>${dialogId}</DialogID></MsgHead>
            <MsgBody>
                <ReturnValue><Code>0010</Code><Message>OK</Message></ReturnValue>
            </MsgBody>
            <MsgTail><MsgNo>1</MsgNo></MsgTail>
        </FinTSMessage>`;
}

function mockFetchForV4(responses: string[]) {
    let callIndex = 0;
    globalThis.fetch = jest.fn().mockImplementation(async () => {
        if (callIndex >= responses.length) {
            throw new Error("No more mock responses");
        }
        return {
            ok: true,
            status: 200,
            text: async () => responses[callIndex++],
        };
    });
}

const baseConfig = {
    blz: "12345678",
    name: "testuser",
    pin: "12345",
    url: "https://banking.example.com/fints",
};

describe("NegotiatingClient: Version negotiation strategy", () => {
    it("detects v4.1 when server responds successfully", async () => {
        // Mock fetch to return valid v4.1 responses for capabilities check
        mockFetchForV4([specSyncResponse(), okResponse("0")]);

        const client = new NegotiatingClient({
            ...baseConfig,
            preferredVersion: "4.1",
            maxRetries: 0,
            retryDelay: 1,
        });

        const version = await client.detectVersion();
        expect(version).toBe("4.1");
        expect(client.protocolVersion).toBe("4.1");
    });

    it("falls back to v3.0 when v4.1 sync fails", async () => {
        globalThis.fetch = jest.fn().mockRejectedValue(new Error("Connection refused"));

        const client = new NegotiatingClient({
            ...baseConfig,
            preferredVersion: "4.1",
            maxRetries: 0,
            retryDelay: 1,
        });

        const version = await client.detectVersion();
        expect(version).toBe("3.0");
    });

    it("routes capabilities() to v4 client when using v4.1", async () => {
        mockFetchForV4([
            specSyncResponse(), okResponse("0"), // detectVersion
            specSyncResponse(), okResponse("0"), // capabilities
        ]);

        const client = new NegotiatingClient({
            ...baseConfig,
            preferredVersion: "4.1",
            maxRetries: 0,
            retryDelay: 1,
        });

        const caps = await client.capabilities();
        expect(caps).toBeDefined();
        expect(caps.supportsAccounts).toBe(true);
    });

    it("routes accounts() to v4 client when using v4.1", async () => {
        mockFetchForV4([
            specSyncResponse(), okResponse("0"), // detectVersion
            specSyncResponse(), okResponse("0"), // sync for accounts
            okResponse("init-d1"),               // init
            `<?xml version="1.0" encoding="UTF-8"?>
                <FinTSMessage xmlns="${FINTS_NAMESPACE}">
                    <MsgHead><MsgNo>1</MsgNo><DialogID>acct-d1</DialogID></MsgHead>
                    <MsgBody>
                        <ReturnValue><Code>0010</Code><Message>OK</Message></ReturnValue>
                        <Segment>
                            <SegHead><Type>AccountList</Type><Version>1</Version><SegNo>3</SegNo></SegHead>
                            <SegBody>
                                <Account>
                                    <IBAN>DE89370400440532013000</IBAN>
                                    <BIC>COBADEFFXXX</BIC>
                                    <AccountNumber>0532013000</AccountNumber>
                                    <BLZ>37040044</BLZ>
                                </Account>
                            </SegBody>
                        </Segment>
                    </MsgBody>
                </FinTSMessage>`,
            okResponse("0"), // end
        ]);

        const client = new NegotiatingClient({
            ...baseConfig,
            preferredVersion: "4.1",
            maxRetries: 0,
            retryDelay: 1,
        });

        const accounts = await client.accounts();
        expect(accounts).toHaveLength(1);
        expect(accounts[0].iban).toBe("DE89370400440532013000");
    });

    it("routes balance() to v4 client when using v4.1", async () => {
        mockFetchForV4([
            specSyncResponse(), okResponse("0"), // detectVersion
            specSyncResponse(), okResponse("0"), // sync for balance
            okResponse("init-d1"),               // init
            okResponse("bal-d1"),                // balance (no data)
            okResponse("0"),                     // end
        ]);

        const client = new NegotiatingClient({
            ...baseConfig,
            preferredVersion: "4.1",
            maxRetries: 0,
            retryDelay: 1,
        });

        const account = {
            iban: "DE89370400440532013000",
            bic: "COBADEFFXXX",
            accountNumber: "0532013000",
            blz: "37040044",
        };

        const balance = await client.balance(account);
        expect(balance).toBeDefined();
    });

    it("routes statements() to v4 client when using v4.1", async () => {
        mockFetchForV4([
            specSyncResponse(), okResponse("0"), // detectVersion
            specSyncResponse(), okResponse("0"), // sync for statements
            okResponse("init-d1"),               // init
            okResponse("stmt-d1"),               // statements (empty)
            okResponse("0"),                     // end
        ]);

        const client = new NegotiatingClient({
            ...baseConfig,
            preferredVersion: "4.1",
            maxRetries: 0,
            retryDelay: 1,
        });

        const account = {
            iban: "DE89370400440532013000",
            bic: "COBADEFFXXX",
            accountNumber: "0532013000",
            blz: "37040044",
        };

        const stmts = await client.statements(account);
        expect(stmts).toEqual([]);
    });
});
