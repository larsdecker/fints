import { Dialog, DialogConfig } from "../dialog";
import { Request } from "../request";
import { TanRequiredError } from "../errors/tan-required-error";
import { ResponseError } from "../errors/response-error";

describe("Dialog", () => {
    const baseConfig: DialogConfig = { blz: "1", name: "user", pin: "123", systemId: "0" } as any;

    test("init adds HKTAN when version >= 6", async () => {
        const connection = {
            send: jest.fn().mockResolvedValue({
                dialogId: "1",
                success: true,
                returnValues: () => new Map(),
            }),
        };
        const dialog = new Dialog(baseConfig, connection as any);
        dialog.hktanVersion = 6;
        await dialog.init();
        const req = connection.send.mock.calls[0][0];
        const hasHKTAN = req.segments.some((seg: any) => seg.type === "HKTAN");
        expect(hasHKTAN).toBe(true);
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
            }),
        };
        const dialog = new Dialog(baseConfig, connection as any);
        await expect(dialog.send(new Request(baseConfig))).rejects.toBeInstanceOf(TanRequiredError);
    });
});
