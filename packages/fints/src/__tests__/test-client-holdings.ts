import { Client } from "../client";
import { Dialog } from "../dialog";
import { HKWPD, HIWPD, Segment } from "../segments";
import { Request } from "../request";
import { SEPAAccount } from "../types";

describe("Client holdings", () => {
    const account: SEPAAccount = {
        accountNumber: "123456789",
        subAccount: "",
        blz: "12345678",
        iban: "DE111234567800000000",
        bic: "GENODE00TES",
    };

    const holdingsSample = (isin: string, name: string) => `
:16R:FIN
:35B:ISIN ${isin}|/DE/ABC123|${name}
:90B::MRKT//ACTU/EUR12,34
:98A::PRIC//20240101
:93B::AGGR//UNIT/1,0000
:19A::HOLD//EUR12,34
:16S:FIN
-`;

    class TestClient extends Client {
        constructor(private readonly testDialog: any) {
            super();
        }

        protected createDialog() {
            return this.testDialog;
        }

        protected createRequest(_dialog: Dialog, segments: Segment<any>[], _tan?: string) {
            return { segments } as unknown as Request;
        }
    }

    test("aggregates holdings across touchdowns", async () => {
        const response1 = {
            getTouchdowns: jest.fn().mockReturnValue(new Map([["HKWPD", "TD123"]])),
            findSegments: jest.fn((segmentClass: any) =>
                segmentClass === HIWPD ? [new HIWPD({ segNo: 4, version: 6, holdings: holdingsSample("LU0000000001", "Fund A") })] : [],
            ),
        };
        const response2 = {
            getTouchdowns: jest.fn().mockReturnValue(new Map()),
            findSegments: jest.fn((segmentClass: any) =>
                segmentClass === HIWPD ? [new HIWPD({ segNo: 4, version: 6, holdings: holdingsSample("LU0000000002", "Fund B") })] : [],
            ),
        };
        const send = jest.fn()
            .mockResolvedValueOnce(response1)
            .mockResolvedValueOnce(response2);
        const dialog = {
            hiwpdsVersion: 6,
            sync: jest.fn().mockResolvedValue(undefined),
            init: jest.fn().mockResolvedValue(undefined),
            end: jest.fn().mockResolvedValue(undefined),
            send,
        };
        const client = new TestClient(dialog);

        const holdings = await client.holdings(account);

        expect(dialog.sync).toHaveBeenCalled();
        expect(dialog.init).toHaveBeenCalled();
        expect(dialog.end).toHaveBeenCalled();
        expect(send).toHaveBeenCalledTimes(2);
        expect((send.mock.calls[0][0].segments[0] as HKWPD).touchdown).toBeUndefined();
        expect((send.mock.calls[1][0].segments[0] as HKWPD).touchdown).toBe("TD123");
        expect(holdings.map((item) => item.isin)).toEqual(["LU0000000001", "LU0000000002"]);
    });

    test("throws when holdings are not supported", async () => {
        const dialog = {
            hiwpdsVersion: 0,
            sync: jest.fn().mockResolvedValue(undefined),
        };
        const client = new TestClient(dialog);
        await expect(client.holdings(account)).rejects.toThrow("Holdings are not supported by this bank.");
    });
});
