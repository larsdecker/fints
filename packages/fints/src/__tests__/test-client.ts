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
});
