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

import GetBalanceCommand, { GetBalanceOptions } from "../commands/get-balance";

const baseOptions: Omit<GetBalanceOptions, "serializer" | "json" | "verbose" | "iban"> = {
    url: "https://bank.example",
    name: "user",
    pin: "12345",
    blz: "87654321",
    productId: "product",
    debug: false,
};

describe("get-balance command", () => {
    let serializer: jest.Mock;
    let infoSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        accountsMock.mockReset();
        balanceMock.mockReset();
        constructorMock.mockClear();
        serializer = jest.fn((value) => JSON.stringify(value));
        infoSpy = jest.spyOn(console, "info").mockImplementation(() => undefined);
        errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        infoSpy.mockRestore();
        errorSpy.mockRestore();
    });

    test("prints the serialized balance for the matching account", async () => {
        const account = { iban: "DE111" };
        const balance = { bookedBalance: 42, currency: "EUR" };
        accountsMock.mockResolvedValue([account]);
        balanceMock.mockResolvedValue(balance);

        const command = new GetBalanceCommand();
        await command.execute({
            ...baseOptions,
            iban: "DE111",
            verbose: true,
            json: false,
            serializer,
        } as unknown as GetBalanceOptions);

        expect(accountsMock).toHaveBeenCalledTimes(1);
        expect(balanceMock).toHaveBeenCalledWith(account);
        expect(serializer).toHaveBeenCalledWith(balance);
        expect(infoSpy).toHaveBeenCalledWith(JSON.stringify(balance));
        expect(errorSpy).not.toHaveBeenCalled();
    });

    test("prints an error when the account cannot be found", async () => {
        accountsMock.mockResolvedValue([{ iban: "DE222" }]);

        const command = new GetBalanceCommand();
        await command.execute({
            ...baseOptions,
            iban: "DE111",
            verbose: false,
            json: false,
            serializer,
        } as unknown as GetBalanceOptions);

        expect(balanceMock).not.toHaveBeenCalled();
        expect(errorSpy).toHaveBeenCalledWith("No account with specified iban found.");
        expect(infoSpy).not.toHaveBeenCalled();
    });
});
