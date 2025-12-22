jest.mock("../logger", () => ({ setLevel: jest.fn() }));

const constructorMock = jest.fn();
const accountsMock = jest.fn();
const balanceMock = jest.fn();
const holdingsMock = jest.fn();

jest.mock(
    "fints-lib",
    () => ({
        __esModule: true,
        PinTanClient: jest.fn().mockImplementation((config: any) => {
            constructorMock(config);
            return {
                accounts: accountsMock,
                balance: balanceMock,
                holdings: holdingsMock,
            };
        }),
    }),
    { virtual: true },
);

import ListHoldingsCommand, { ListHoldingsOptions } from "../commands/list-holdings";

const baseOptions: Omit<ListHoldingsOptions, "serializer" | "json" | "verbose" | "iban"> = {
    url: "https://bank.example",
    name: "user",
    pin: "12345",
    blz: "87654321",
    productId: "product",
    debug: false,
};

describe("list-holdings command", () => {
    let serializer: jest.Mock;
    let infoSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        accountsMock.mockReset();
        holdingsMock.mockReset();
        constructorMock.mockClear();
        serializer = jest.fn((value) => JSON.stringify(value));
        infoSpy = jest.spyOn(console, "info").mockImplementation(() => undefined);
        errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        infoSpy.mockRestore();
        errorSpy.mockRestore();
    });

    test("prints serialized holdings when an account is found", async () => {
        const account = { iban: "DE111" };
        const holdings = [
            { isin: "LU0000000001", name: "Fund A" },
            { isin: "LU0000000002", name: "Fund B" },
        ];
        accountsMock.mockResolvedValue([account]);
        holdingsMock.mockResolvedValue(holdings);

        const command = new ListHoldingsCommand();
        await command.execute({
            ...baseOptions,
            iban: "DE111",
            verbose: false,
            json: false,
            serializer,
        } as unknown as ListHoldingsOptions);

        expect(accountsMock).toHaveBeenCalledTimes(1);
        expect(holdingsMock).toHaveBeenCalledWith(account);
        expect(serializer).toHaveBeenCalledWith(holdings);
        expect(infoSpy).toHaveBeenCalledWith(JSON.stringify(holdings));
        expect(errorSpy).not.toHaveBeenCalled();
    });

    test("prints an error message when the account is missing", async () => {
        accountsMock.mockResolvedValue([{ iban: "DE222" }]);

        const command = new ListHoldingsCommand();
        await command.execute({
            ...baseOptions,
            iban: "DE111",
            verbose: false,
            json: false,
            serializer,
        } as unknown as ListHoldingsOptions);

        expect(holdingsMock).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith("No account with specified iban found.");
        expect(infoSpy).not.toHaveBeenCalled();
    });

    test("prints the received error when loading holdings fails", async () => {
        const account = { iban: "DE111" };
        accountsMock.mockResolvedValue([account]);
        holdingsMock.mockRejectedValue(new Error("Holdings are not supported."));

        const command = new ListHoldingsCommand();
        await command.execute({
            ...baseOptions,
            iban: "DE111",
            verbose: false,
            json: false,
            serializer,
        } as unknown as ListHoldingsOptions);

        expect(holdingsMock).toHaveBeenCalledWith(account);
        expect(serializer).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith("Holdings are not supported.");
        expect(infoSpy).not.toHaveBeenCalled();
    });
});
