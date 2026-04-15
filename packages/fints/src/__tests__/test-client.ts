import { Client } from "../client";
import { Dialog, DialogConfig } from "../dialog";
import { Segment, HKTAN } from "../segments";
import { Request } from "../request";
import { TanMethod } from "../tan-method";

class TestClient extends Client {
    constructor(
        private readonly baseConfig: DialogConfig,
        private readonly mockConnection: any,
    ) {
        super();
    }

    protected createDialog(dialogConfig?: DialogConfig): Dialog {
        const config = dialogConfig ? dialogConfig : this.baseConfig;
        return new Dialog(config, this.mockConnection);
    }

    protected createRequest(dialog: Dialog, segments: Segment<any>[], tan?: string): Request {
        return new Request({
            blz: dialog.blz,
            name: dialog.name,
            pin: dialog.pin,
            systemId: dialog.systemId,
            dialogId: dialog.dialogId,
            msgNo: dialog.msgNo,
            segments,
            tanMethods: dialog.tanMethods,
            tan,
        });
    }
}

describe("Client", () => {
    const baseConfig: DialogConfig = { blz: "12345678", name: "user", pin: "secret", systemId: "1" } as DialogConfig;

    test("completeLogin sends a follow-up TAN request and returns the updated dialog", async () => {
        const connection = {
            send: jest.fn().mockResolvedValue({
                success: true,
                returnValues: () => new Map(),
                dialogId: "9999",
            }),
        };
        const client = new TestClient(baseConfig, connection as any);
        const savedDialog = new Dialog(baseConfig, connection as any);
        savedDialog.hktanVersion = 7;
        const tanMethod = new TanMethod(6);
        tanMethod.name = "photoTAN";
        savedDialog.tanMethods = [tanMethod];
        savedDialog.msgNo = 1;
        savedDialog.dialogId = "13579";

        const resumedDialog = await client.completeLogin(savedDialog, "ref123", "987654");

        expect(connection.send).toHaveBeenCalledTimes(1);
        const request = connection.send.mock.calls[0][0] as Request;
        expect(request.tan).toBe("987654");
        expect(request.msgNo).toBe(2);
        expect(request.segments).toHaveLength(1);
        const hktan = request.segments[0] as HKTAN;
        expect(hktan.process).toBe("2");
        expect(hktan.aref).toBe("ref123");
        expect(resumedDialog).toBeInstanceOf(Dialog);
        expect(resumedDialog.dialogId).toBe("9999");
        expect(resumedDialog.msgNo).toBe(3);
    });

    test("capabilities returns bank features derived from the sync response", async () => {
        // First call is the sync request; second call is the end request.
        const syncResponse = {
            success: true,
            returnValues: () => new Map(),
            dialogId: "sync-dialog",
            systemId: "sys-1",
            segmentMaxVersion: (cls: any) => {
                const versionMap: Record<string, number> = {
                    HISALS: 5,
                    HIKAZS: 6,
                    HICDBS: 1,
                    HIDSES: 0,
                    HICCSS: 3,
                    HIWPDS: 6,
                    HITANS: 6,
                };
                return versionMap[cls.name] ?? 0;
            },
            supportedTanMethods: [] as any[],
            painFormats: [] as string[],
            findSegment: (cls: any) => {
                if (cls.name === "HIKAZS") return { minSignatures: 1 };
                if (cls.name === "HISALS") return { minSignatures: 0 };
                return undefined;
            },
            findSegments: () => [] as any[],
        };
        const endResponse = {
            success: true,
            returnValues: () => new Map(),
            dialogId: "0",
        };

        let callCount = 0;
        const connection = {
            send: jest.fn().mockImplementation(() => {
                callCount++;
                return Promise.resolve(callCount === 1 ? syncResponse : endResponse);
            }),
        };

        const client = new TestClient(baseConfig, connection as any);
        const caps = await client.capabilities();

        expect(caps.supportsAccounts).toBe(true);
        expect(caps.supportsBalance).toBe(true); // HISALS version 5
        expect(caps.supportsTransactions).toBe(true); // HIKAZS version 6
        expect(caps.supportsHoldings).toBe(true); // HIWPDS version 6
        expect(caps.supportsStandingOrders).toBe(true); // HICDBS version 1
        expect(caps.supportsCreditTransfer).toBe(true); // HICCSS version 3
        expect(caps.supportsDirectDebit).toBe(false); // HIDSES version 0
        expect(caps.requiresTanForTransactions).toBe(true); // minSignatures 1
        expect(caps.requiresTanForBalance).toBe(false); // minSignatures 0
    });

    test("capabilities returns all false when bank advertises no optional features", async () => {
        const syncResponse = {
            success: true,
            returnValues: () => new Map(),
            dialogId: "sync-dialog",
            systemId: "sys-1",
            segmentMaxVersion: (_cls: any) => 0,
            supportedTanMethods: [] as any[],
            painFormats: [] as string[],
            findSegment: (_cls: any): any => undefined,
            findSegments: () => [] as any[],
        };
        const endResponse = {
            success: true,
            returnValues: () => new Map(),
            dialogId: "0",
        };

        let callCount = 0;
        const connection = {
            send: jest.fn().mockImplementation(() => {
                callCount++;
                return Promise.resolve(callCount === 1 ? syncResponse : endResponse);
            }),
        };

        const client = new TestClient(baseConfig, connection as any);
        const caps = await client.capabilities();

        expect(caps.supportsAccounts).toBe(true); // always true
        expect(caps.supportsBalance).toBe(false);
        expect(caps.supportsTransactions).toBe(false);
        expect(caps.supportsHoldings).toBe(false);
        expect(caps.supportsStandingOrders).toBe(false);
        expect(caps.supportsCreditTransfer).toBe(false);
        expect(caps.supportsDirectDebit).toBe(false);
        expect(caps.requiresTanForTransactions).toBe(false);
        expect(caps.requiresTanForBalance).toBe(false);
    });
});
