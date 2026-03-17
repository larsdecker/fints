import { Dialog, DialogConfig } from "../dialog";
import { Request } from "../request";
import { TanRequiredError } from "../errors/tan-required-error";
import { ResponseError } from "../errors/response-error";

describe("Dialog", () => {
    const baseConfig: DialogConfig = { blz: "1", name: "user", pin: "123", systemId: "0" } as any;

    test("init adds HKTAN with highest supported version", async () => {
        const connection = {
            send: jest.fn().mockResolvedValue({
                dialogId: "1",
                success: true,
                returnValues: () => new Map(),
            }),
        };
        const dialog = new Dialog(baseConfig, connection as any);
        dialog.hktanVersion = 7;
        await dialog.init();
        const req = connection.send.mock.calls[0][0];
        const hktan = req.segments.find((seg: any) => seg.type === "HKTAN");
        expect(hktan).toBeDefined();
        expect(hktan.version).toBe(7);
    });

    test("send throws ResponseError on failure", async () => {
        const connection = {
            send: jest.fn().mockResolvedValue({ success: false, returnValues: () => new Map(), errors: [] }),
        };
        const dialog = new Dialog(baseConfig, connection as any);
        await expect(dialog.send(new Request(baseConfig))).rejects.toBeInstanceOf(ResponseError);
    });

    test("send throws TanRequiredError when TAN is required", async () => {
        const hitan = { transactionReference: "ref", challengeText: "text", challengeMedia: Buffer.alloc(0) };
        const connection = {
            send: jest.fn().mockResolvedValue({
                success: true,
                returnValues: () => new Map([["0030", { message: "TAN required" }]]),
                findSegment: () => hitan,
                dialogId: "4711",
            }),
        };
        const dialog = new Dialog(baseConfig, connection as any);
        expect.assertions(3);
        try {
            await dialog.send(new Request(baseConfig));
            throw new Error("Expected TAN challenge to trigger TanRequiredError.");
        } catch (error) {
            expect(error).toBeInstanceOf(TanRequiredError);
            expect((error as TanRequiredError).dialog.dialogId).toBe("4711");
            expect(dialog.dialogId).toBe("4711");
        }
    });

    test("capabilities getter reflects fields set during sync", () => {
        const dialog = new Dialog(baseConfig, {} as any);

        // Simulate the state after a sync response has been processed.
        dialog.supportsBalance = true;
        dialog.supportsTransactions = true;
        dialog.hiwpdsVersion = 6;
        dialog.supportsStandingOrders = true;
        dialog.supportsCreditTransfer = true;
        dialog.supportsDirectDebit = false;
        dialog.hikazsMinSignatures = 1;
        dialog.hisalsMinSignatures = 0;

        const caps = dialog.capabilities;

        expect(caps.supportsAccounts).toBe(true);
        expect(caps.supportsBalance).toBe(true);
        expect(caps.supportsTransactions).toBe(true);
        expect(caps.supportsHoldings).toBe(true);
        expect(caps.supportsStandingOrders).toBe(true);
        expect(caps.supportsCreditTransfer).toBe(true);
        expect(caps.supportsDirectDebit).toBe(false);
        expect(caps.requiresTanForTransactions).toBe(true);
        expect(caps.requiresTanForBalance).toBe(false);
    });

    test("capabilities getter returns false for unsupported features", () => {
        const dialog = new Dialog(baseConfig, {} as any);

        // Simulate a bank that advertises no optional features.
        dialog.supportsBalance = false;
        dialog.supportsTransactions = false;
        dialog.hiwpdsVersion = 0;
        dialog.supportsStandingOrders = false;
        dialog.supportsCreditTransfer = false;
        dialog.supportsDirectDebit = false;
        dialog.hikazsMinSignatures = 0;
        dialog.hisalsMinSignatures = 0;

        const caps = dialog.capabilities;

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

    test("capabilities getter returns false before sync() is called", () => {
        const dialog = new Dialog(baseConfig, {} as any);
        // No sync() has run - all support flags should be false
        const caps = dialog.capabilities;
        expect(caps.supportsBalance).toBe(false);
        expect(caps.supportsTransactions).toBe(false);
        expect(caps.supportsHoldings).toBe(false);
        expect(caps.supportsStandingOrders).toBe(false);
        expect(caps.supportsCreditTransfer).toBe(false);
        expect(caps.supportsDirectDebit).toBe(false);
    });
});
