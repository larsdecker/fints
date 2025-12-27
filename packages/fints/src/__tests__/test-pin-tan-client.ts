import { format } from "date-fns";
import { readFileSync } from "fs";
import { PinTanClient } from "../pin-tan-client";
import { encodeBase64, decodeBase64 } from "../utils";
import { Format } from "../format";

declare const Response: any;

const url = "https://example.com/fints";
const name = "test1";
const pin = "12345";
const blz = "12345678";
const productId = "fints";

let client: PinTanClient;

beforeEach(() => {
    jest.spyOn(Format, "date").mockImplementation((date) => (date ? format(date, "yyyyMMdd") : "20180101"));
    jest.spyOn(Format, "time").mockImplementation((time) => (time ? format(time, "HHmmss") : "120000"));
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    client = new PinTanClient({ blz, name, pin, url, productId });
});

test("accounts", async () => {
    const responseFixtures: string[] = JSON.parse(readFileSync(`${__dirname}/fixture-accounts.json`, "utf8"));
    let responseNo = 0;
    const sentBodies: string[] = [];

    const fetchSpy = jest.spyOn(global, "fetch" as any).mockImplementation((input: any, init: any) => {
        const body = String(init?.body ?? "");
        sentBodies.push(body);
        const response = encodeBase64(responseFixtures[responseNo]);
        responseNo++;
        return Promise.resolve(new Response(response));
    });

    const result = await client.accounts();
    expect(result).toMatchSnapshot();
    const calls = sentBodies.map((body) => decodeBase64(String(body)));
    expect(calls).toMatchSnapshot();
    fetchSpy.mockRestore();
});

test("statements", async () => {
    const responseFixtures: string[] = JSON.parse(readFileSync(`${__dirname}/fixture-statements.json`, "utf8"));
    let responseNo = 0;
    const sentBodies: string[] = [];

    const fetchSpy = jest.spyOn(global, "fetch" as any).mockImplementation((input: any, init: any) => {
        const body = String(init?.body ?? "");
        sentBodies.push(body);
        const response = encodeBase64(responseFixtures[responseNo]);
        responseNo++;
        return Promise.resolve(new Response(response));
    });

    const account = {
        accountNumber: "2",
        bic: "GENODE00TES",
        blz: "12345678",
        iban: "DE111234567800000002",
        subAccount: "",
    };
    const result = await client.statements(account, new Date("2018-01-01T12:00:00Z"), new Date("2018-10-01T12:00:00Z"));
    expect(result).toMatchSnapshot();
    const calls = sentBodies.map((body) => decodeBase64(String(body)));
    expect(calls).toMatchSnapshot();
    fetchSpy.mockRestore();
});

test("balance", async () => {
    const responseFixtures: string[] = JSON.parse(readFileSync(`${__dirname}/fixture-balance.json`, "utf8"));
    let responseNo = 0;
    const sentBodies: string[] = [];

    const fetchSpy = jest.spyOn(global, "fetch" as any).mockImplementation((input: any, init: any) => {
        const body = String(init?.body ?? "");
        sentBodies.push(body);
        const response = encodeBase64(responseFixtures[responseNo]);
        responseNo++;
        return Promise.resolve(new Response(response));
    });

    const account = {
        accountNumber: "2",
        bic: "GENODE00TES",
        blz: "12346789",
        iban: "DE111234567800000002",
        subAccount: "",
    };
    const result = await client.balance(account);
    expect(result).toMatchSnapshot();
    const calls = sentBodies.map((body) => decodeBase64(String(body)));
    expect(calls).toMatchSnapshot();
    fetchSpy.mockRestore();
});

test("standingOrders", async () => {
    let responseFixtures: string[] = JSON.parse(readFileSync(`${__dirname}/fixture-standingOrders.json`, "utf8"));
    let responseNo = 0;
    const sentBodies: string[] = [];

    const fetchSpy = jest.spyOn(global, "fetch" as any).mockImplementation((input: any, init: any) => {
        const body = String(init?.body ?? "");
        sentBodies.push(body);
        const response = encodeBase64(responseFixtures[responseNo]);
        responseNo++;
        return Promise.resolve(new Response(response));
    });

    const account = {
        accountNumber: "2",
        bic: "DEUTDEFF500",
        blz: "12346789",
        iban: "DE27100777770209299700",
        subAccount: "",
    };
    const result = await client.standingOrders(account);
    expect(result).toMatchSnapshot();
    const calls = sentBodies.map((body) => decodeBase64(String(body)));
    expect(calls).toMatchSnapshot();
    fetchSpy.mockRestore();
});
