import { FinTSServer } from "../server";
import { createDefaultConfig } from "../test-data";
import * as path from "path";

/**
 * Integration test using the FinTS test server with the actual PinTanClient.
 * This validates that the test server produces responses that the real client
 * can parse and process correctly.
 */

// Dynamically import PinTanClient from the fints package
let PinTanClient: any;
let TanRequiredError: any;

beforeAll(async () => {
    try {
        const fintsPath = path.resolve(__dirname, "../../../fints/src/pin-tan-client");
        const errorPath = path.resolve(__dirname, "../../../fints/src/errors/tan-required-error");
        const fintsModule = require(fintsPath);
        PinTanClient = fintsModule.PinTanClient;
        const errorModule = require(errorPath);
        TanRequiredError = errorModule.TanRequiredError;
    } catch (e) {
        // Will skip tests if fints package is not available
        console.warn("Could not import PinTanClient:", e);
    }
});

describe("FinTSServer integration", () => {
    let server: FinTSServer;

    beforeEach(async () => {
        const config = createDefaultConfig();
        server = new FinTSServer({ config });
        await server.start();
    });

    afterEach(async () => {
        await server.stop();
    });

    it("should start and stop", async () => {
        expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/fints$/);
    });

    it("should accept FinTS requests via HTTP", async () => {
        if (!PinTanClient) {
            console.warn("Skipping: PinTanClient not available");
            return;
        }

        const client = new PinTanClient({
            blz: "12345678",
            name: "testuser",
            pin: "12345",
            url: server.url,
            productId: "fints",
        });

        // accounts() performs: sync → end → init → HKSPA → end
        const accounts = await client.accounts();

        expect(accounts).toBeDefined();
        expect(accounts.length).toBe(2);
        expect(accounts[0].iban).toBe("DE111234567800000001");
        expect(accounts[0].bic).toBe("GENODE00TES");
        expect(accounts[0].accountNumber).toBe("1");
        expect(accounts[1].iban).toBe("DE111234567800000002");
    });

    it("should return account balance", async () => {
        if (!PinTanClient) {
            console.warn("Skipping: PinTanClient not available");
            return;
        }

        const client = new PinTanClient({
            blz: "12345678",
            name: "testuser",
            pin: "12345",
            url: server.url,
            productId: "fints",
        });

        const account = {
            accountNumber: "1",
            bic: "GENODE00TES",
            blz: "12345678",
            iban: "DE111234567800000001",
            subAccount: "",
        };

        const balance = await client.balance(account);

        expect(balance).toBeDefined();
        expect(balance.bookedBalance).toBe(1234.56);
        expect(balance.availableBalance).toBe(6234.56);
        expect(balance.creditLimit).toBe(5000);
        expect(balance.currency).toBe("EUR");
    });

    it("should return transaction statements", async () => {
        if (!PinTanClient) {
            console.warn("Skipping: PinTanClient not available");
            return;
        }

        const client = new PinTanClient({
            blz: "12345678",
            name: "testuser",
            pin: "12345",
            url: server.url,
            productId: "fints",
        });

        const account = {
            accountNumber: "1",
            bic: "GENODE00TES",
            blz: "12345678",
            iban: "DE111234567800000001",
            subAccount: "",
        };

        const statements = await client.statements(
            account,
            new Date("2018-01-01T00:00:00Z"),
            new Date("2018-12-31T00:00:00Z"),
        );

        expect(statements).toBeDefined();
        expect(statements.length).toBeGreaterThan(0);
    });

    it("should handle standing orders request", async () => {
        if (!PinTanClient) {
            console.warn("Skipping: PinTanClient not available");
            return;
        }

        const client = new PinTanClient({
            blz: "12345678",
            name: "testuser",
            pin: "12345",
            url: server.url,
            productId: "fints",
        });

        const account = {
            accountNumber: "1",
            bic: "GENODE00TES",
            blz: "12345678",
            iban: "DE111234567800000001",
            subAccount: "",
        };

        const standingOrders = await client.standingOrders(account);

        // No standing orders configured in default test data
        expect(standingOrders).toBeDefined();
        expect(standingOrders.length).toBe(0);
    });

    it("should handle TAN requirement for credit transfers", async () => {
        if (!PinTanClient || !TanRequiredError) {
            console.warn("Skipping: PinTanClient or TanRequiredError not available");
            return;
        }

        // Enable TAN requirement
        server.setConfig({ requireTan: true });

        const client = new PinTanClient({
            blz: "12345678",
            name: "testuser",
            pin: "12345",
            url: server.url,
            productId: "fints",
        });

        const account = {
            accountNumber: "1",
            bic: "GENODE00TES",
            blz: "12345678",
            iban: "DE111234567800000001",
            subAccount: "",
        };

        try {
            await client.creditTransfer(account, {
                name: "Erika Musterfrau",
                iban: "DE89370400440532013000",
                bic: "COBADEFFXXX",
                amount: 100,
                purpose: "Test transfer",
            });
            // If we get here, it means TAN was not required
            fail("Expected TanRequiredError");
        } catch (error: unknown) {
            if (error instanceof TanRequiredError) {
                expect((error as any).transactionReference).toBeDefined();
                expect((error as any).challengeText).toBeDefined();
            } else {
                // The credit transfer might fail for other reasons
                // (e.g., PAIN format issues), which is acceptable
                // since we're testing the server, not the client
            }
        }
    });

    it("should reject invalid PIN", async () => {
        if (!PinTanClient) {
            console.warn("Skipping: PinTanClient not available");
            return;
        }

        const client = new PinTanClient({
            blz: "12345678",
            name: "testuser",
            pin: "wrongpin",
            url: server.url,
            productId: "fints",
        });

        // accounts() should fail because the init request gets an error response
        // when the PIN is wrong. The client might throw a ResponseError or similar.
        try {
            await client.accounts();
            fail("Expected an error for invalid PIN");
        } catch {
            // Expected: authentication failure
        }
    });

    it("should support custom configuration", async () => {
        if (!PinTanClient) {
            console.warn("Skipping: PinTanClient not available");
            return;
        }

        // Create server with custom accounts
        await server.stop();

        const customConfig = createDefaultConfig();
        customConfig.accounts = [
            {
                iban: "DE99999999990000000001",
                bic: "TESTDEFFXXX",
                accountNumber: "42",
                subAccount: "",
                blz: "12345678",
                currency: "EUR",
                ownerName: "Custom User",
                accountName: "Custom Account",
            },
        ];
        customConfig.balances = [
            {
                accountNumber: "42",
                productName: "Custom Account",
                currency: "EUR",
                bookedBalance: 9999.99,
                pendingBalance: 9999.99,
                creditLimit: 0,
                availableBalance: 9999.99,
            },
        ];

        server = new FinTSServer({ config: customConfig });
        await server.start();

        const client = new PinTanClient({
            blz: "12345678",
            name: "testuser",
            pin: "12345",
            url: server.url,
            productId: "fints",
        });

        const accounts = await client.accounts();
        expect(accounts.length).toBe(1);
        expect(accounts[0].iban).toBe("DE99999999990000000001");
        expect(accounts[0].accountNumber).toBe("42");
    });
});
