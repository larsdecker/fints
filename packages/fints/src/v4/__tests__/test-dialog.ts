import { FinTS4Dialog } from "../dialog";
import { FinTS4Connection, FinTS4DialogConfig } from "../types";
import { FINTS_NAMESPACE } from "../constants";

/**
 * Create a mock connection that returns predefined XML responses.
 */
function createMockConnection(responses: string[]): FinTS4Connection & { calls: string[] } {
    let callIndex = 0;
    const calls: string[] = [];
    return {
        calls,
        async send(xmlRequest: string): Promise<string> {
            calls.push(xmlRequest);
            if (callIndex >= responses.length) {
                throw new Error("No more mock responses available");
            }
            return responses[callIndex++];
        },
    };
}

function buildSuccessResponse(dialogId: string, extra = ""): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
        <FinTSMessage xmlns="${FINTS_NAMESPACE}">
            <MsgHead>
                <MsgNo>1</MsgNo>
                <DialogID>${dialogId}</DialogID>
            </MsgHead>
            <MsgBody>
                <ReturnValue>
                    <Code>0010</Code>
                    <Message>Nachricht entgegengenommen</Message>
                </ReturnValue>
                ${extra}
            </MsgBody>
            <MsgTail><MsgNo>1</MsgNo></MsgTail>
        </FinTSMessage>`;
}

function buildSyncResponse(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
        <FinTSMessage xmlns="${FINTS_NAMESPACE}">
            <MsgHead>
                <MsgNo>1</MsgNo>
                <DialogID>sync-dialog-1</DialogID>
            </MsgHead>
            <MsgBody>
                <ReturnValue>
                    <Code>0010</Code>
                    <Message>Nachricht entgegengenommen</Message>
                </ReturnValue>
                <Segment>
                    <SegHead>
                        <Type>SyncRes</Type>
                        <Version>1</Version>
                        <SegNo>1</SegNo>
                    </SegHead>
                    <SegBody>
                        <SystemID>system-id-abc</SystemID>
                    </SegBody>
                </Segment>
                <Segment>
                    <SegHead>
                        <Type>BPD</Type>
                        <Version>1</Version>
                        <SegNo>2</SegNo>
                    </SegHead>
                    <SegBody>
                        <BPD>
                            <BankName>Test Bank AG</BankName>
                            <BPDVersion>1</BPDVersion>
                        </BPD>
                    </SegBody>
                </Segment>
                <Segment>
                    <SegHead>
                        <Type>TANMethods</Type>
                        <Version>1</Version>
                        <SegNo>3</SegNo>
                    </SegHead>
                    <SegBody>
                        <TANMethod>
                            <SecurityFunction>912</SecurityFunction>
                            <TANProcess>2</TANProcess>
                            <Name>pushTAN</Name>
                            <MaxLengthInput>6</MaxLengthInput>
                        </TANMethod>
                    </SegBody>
                </Segment>
                <Segment>
                    <SegHead>
                        <Type>Balance</Type>
                        <Version>3</Version>
                        <SegNo>4</SegNo>
                    </SegHead>
                    <SegBody></SegBody>
                </Segment>
                <Segment>
                    <SegHead>
                        <Type>AccountStatement</Type>
                        <Version>2</Version>
                        <SegNo>5</SegNo>
                    </SegHead>
                    <SegBody></SegBody>
                </Segment>
                <Segment>
                    <SegHead><Type>Holdings</Type><Version>1</Version><SegNo>6</SegNo></SegHead>
                    <SegBody></SegBody>
                </Segment>
                <Segment>
                    <SegHead><Type>StandingOrders</Type><Version>1</Version><SegNo>7</SegNo></SegHead>
                    <SegBody></SegBody>
                </Segment>
                <Segment>
                    <SegHead><Type>CreditTransfer</Type><Version>1</Version><SegNo>8</SegNo></SegHead>
                    <SegBody></SegBody>
                </Segment>
                <Segment>
                    <SegHead><Type>DirectDebit</Type><Version>1</Version><SegNo>9</SegNo></SegHead>
                    <SegBody></SegBody>
                </Segment>
            </MsgBody>
            <MsgTail><MsgNo>1</MsgNo></MsgTail>
        </FinTSMessage>`;
}

function buildErrorResponse(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
        <FinTSMessage xmlns="${FINTS_NAMESPACE}">
            <MsgHead>
                <MsgNo>1</MsgNo>
                <DialogID>err-dialog</DialogID>
            </MsgHead>
            <MsgBody>
                <ReturnValue>
                    <Code>9010</Code>
                    <Message>Verarbeitung nicht möglich</Message>
                </ReturnValue>
            </MsgBody>
        </FinTSMessage>`;
}

const baseConfig: FinTS4DialogConfig = {
    blz: "12345678",
    name: "testuser",
    pin: "12345",
    systemId: "0",
    productId: "testProduct",
};

describe("FinTS4Dialog", () => {
    describe("constructor", () => {
        it("initializes with config values", () => {
            const conn = createMockConnection([]);
            const dialog = new FinTS4Dialog(baseConfig, conn);

            expect(dialog.blz).toBe("12345678");
            expect(dialog.name).toBe("testuser");
            expect(dialog.pin).toBe("12345");
            expect(dialog.systemId).toBe("0");
            expect(dialog.productId).toBe("testProduct");
            expect(dialog.msgNo).toBe(1);
            expect(dialog.dialogId).toBe("0");
        });

        it("respects provided systemId even if empty string", () => {
            const conn = createMockConnection([]);
            const dialog = new FinTS4Dialog({ ...baseConfig, systemId: "custom-sys" }, conn);
            expect(dialog.systemId).toBe("custom-sys");
        });
    });

    describe("send", () => {
        it("sends XML request and parses response", async () => {
            const conn = createMockConnection([buildSuccessResponse("d1")]);
            const dialog = new FinTS4Dialog(baseConfig, conn);

            const response = await dialog.send([{ type: "Test", version: 1, segNo: 1, body: "<Data>test</Data>" }]);

            expect(response.dialogId).toBe("d1");
            expect(response.success).toBe(true);
            expect(conn.calls.length).toBe(1);
        });

        it("updates dialog ID from response", async () => {
            const conn = createMockConnection([buildSuccessResponse("new-dialog-id")]);
            const dialog = new FinTS4Dialog(baseConfig, conn);

            await dialog.send([{ type: "Test", version: 1, segNo: 1, body: "" }]);

            expect(dialog.dialogId).toBe("new-dialog-id");
        });

        it("increments message number after successful send", async () => {
            const conn = createMockConnection([buildSuccessResponse("d1"), buildSuccessResponse("d1")]);
            const dialog = new FinTS4Dialog(baseConfig, conn);

            expect(dialog.msgNo).toBe(1);
            await dialog.send([{ type: "Test", version: 1, segNo: 1, body: "" }]);
            expect(dialog.msgNo).toBe(2);
            await dialog.send([{ type: "Test", version: 1, segNo: 1, body: "" }]);
            expect(dialog.msgNo).toBe(3);
        });

        it("throws on error response", async () => {
            const conn = createMockConnection([buildErrorResponse()]);
            const dialog = new FinTS4Dialog(baseConfig, conn);

            await expect(dialog.send([{ type: "Test", version: 1, segNo: 1, body: "" }])).rejects.toThrow(
                "FinTS 4.1 request failed",
            );
        });

        it("does not update dialogId when response has '0'", async () => {
            const response = `<?xml version="1.0" encoding="UTF-8"?>
                <FinTSMessage>
                    <MsgHead><MsgNo>1</MsgNo><DialogID>0</DialogID></MsgHead>
                    <MsgBody></MsgBody>
                </FinTSMessage>`;
            const conn = createMockConnection([response]);
            const dialog = new FinTS4Dialog(baseConfig, conn);
            dialog.dialogId = "existing";

            await dialog.send([{ type: "Test", version: 1, segNo: 1, body: "" }]);

            expect(dialog.dialogId).toBe("existing");
        });
    });

    describe("sync", () => {
        it("performs synchronization and updates state", async () => {
            const conn = createMockConnection([
                buildSyncResponse(),
                buildSuccessResponse("0"), // end dialog
            ]);
            const dialog = new FinTS4Dialog(baseConfig, conn);

            await dialog.sync();

            expect(dialog.systemId).toBe("system-id-abc");
            expect(dialog.bpd).toBeDefined();
            expect(dialog.bpd!.bankName).toBe("Test Bank AG");
            expect(dialog.tanMethods.length).toBe(1);
            expect(dialog.tanMethods[0].name).toBe("pushTAN");
        });

        it("updates security function when no 999 method found", async () => {
            const conn = createMockConnection([buildSyncResponse(), buildSuccessResponse("0")]);
            const dialog = new FinTS4Dialog(baseConfig, conn);

            await dialog.sync();

            expect(dialog.securityFunction).toBe("912");
        });

        it("updates capabilities from segment versions", async () => {
            const conn = createMockConnection([buildSyncResponse(), buildSuccessResponse("0")]);
            const dialog = new FinTS4Dialog(baseConfig, conn);

            await dialog.sync();

            expect(dialog.supportsBalance).toBe(true);
            expect(dialog.supportsStatements).toBe(true);
            expect(dialog.supportsHoldings).toBe(true);
            expect(dialog.supportsStandingOrders).toBe(true);
            expect(dialog.supportsCreditTransfer).toBe(true);
            expect(dialog.supportsDirectDebit).toBe(true);
            expect(dialog.balanceVersion).toBe(3);
            expect(dialog.statementVersion).toBe(2);
        });

        it("ends the sync dialog", async () => {
            const conn = createMockConnection([buildSyncResponse(), buildSuccessResponse("0")]);
            const dialog = new FinTS4Dialog(baseConfig, conn);

            await dialog.sync();

            // Should have sent 2 messages: sync + end
            expect(conn.calls.length).toBe(2);
            expect(dialog.dialogId).toBe("0");
            expect(dialog.msgNo).toBe(1);
        });
    });

    describe("init", () => {
        it("sends dialog initialization", async () => {
            const conn = createMockConnection([buildSuccessResponse("init-dialog-1")]);
            const dialog = new FinTS4Dialog(baseConfig, conn);

            await dialog.init();

            expect(dialog.dialogId).toBe("init-dialog-1");
            expect(conn.calls.length).toBe(1);
        });

        it("includes TAN segment when TAN methods are available", async () => {
            const conn = createMockConnection([buildSuccessResponse("d1")]);
            const dialog = new FinTS4Dialog(baseConfig, conn);
            dialog.tanMethods = [
                {
                    securityFunction: "912",
                    tanProcess: "2",
                    techId: "",
                    name: "pushTAN",
                    maxLengthInput: 6,
                    allowedFormat: "0",
                    tanListNumberRequired: false,
                    cancellable: false,
                },
            ];
            dialog.tanVersion = 2;

            await dialog.init();

            const requestXml = conn.calls[0];
            expect(requestXml).toContain("TAN");
        });
    });

    describe("end", () => {
        it("sends dialog end and resets state", async () => {
            const conn = createMockConnection([buildSuccessResponse("0")]);
            const dialog = new FinTS4Dialog(baseConfig, conn);
            dialog.dialogId = "active-dialog";
            dialog.msgNo = 5;

            await dialog.end();

            expect(dialog.dialogId).toBe("0");
            expect(dialog.msgNo).toBe(1);
        });

        it("resets state even on error", async () => {
            const conn = createMockConnection([buildErrorResponse()]);
            const dialog = new FinTS4Dialog(baseConfig, conn);
            dialog.dialogId = "active-dialog";

            await expect(dialog.end()).rejects.toThrow();
            expect(dialog.dialogId).toBe("0");
            expect(dialog.msgNo).toBe(1);
        });
    });

    describe("capabilities", () => {
        it("reflects state after sync", () => {
            const conn = createMockConnection([]);
            const dialog = new FinTS4Dialog(baseConfig, conn);
            dialog.supportsBalance = true;
            dialog.supportsStatements = true;
            dialog.supportsHoldings = true;
            dialog.supportsStandingOrders = true;
            dialog.supportsCreditTransfer = true;
            dialog.supportsDirectDebit = true;

            const caps = dialog.capabilities;

            expect(caps.supportsAccounts).toBe(true);
            expect(caps.supportsBalance).toBe(true);
            expect(caps.supportsTransactions).toBe(true);
            expect(caps.supportsHoldings).toBe(true);
            expect(caps.supportsStandingOrders).toBe(true);
            expect(caps.supportsCreditTransfer).toBe(true);
            expect(caps.supportsDirectDebit).toBe(true);
        });

        it("returns false for unsupported features before sync", () => {
            const conn = createMockConnection([]);
            const dialog = new FinTS4Dialog(baseConfig, conn);

            const caps = dialog.capabilities;

            expect(caps.supportsBalance).toBe(false);
            expect(caps.supportsTransactions).toBe(false);
        });

        it("reflects TAN requirements", () => {
            const conn = createMockConnection([]);
            const dialog = new FinTS4Dialog(baseConfig, conn);
            dialog.statementsMinSignatures = 1;
            dialog.balanceMinSignatures = 0;

            const caps = dialog.capabilities;

            expect(caps.requiresTanForTransactions).toBe(true);
            expect(caps.requiresTanForBalance).toBe(false);
        });
    });
});
