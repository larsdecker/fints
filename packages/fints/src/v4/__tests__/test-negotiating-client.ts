import { NegotiatingClient, FinTSProtocolVersion } from "../../negotiating-client";
import { FinTS4Client } from "../client";
import { PinTanClient } from "../../pin-tan-client";

// Mock fetch
const originalFetch = globalThis.fetch;

function mockFetchError() {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error("Connection failed"));
}

function mockFetchOk(responses: string[]) {
    let callIndex = 0;
    globalThis.fetch = jest.fn().mockImplementation(async () => {
        if (callIndex >= responses.length) {
            throw new Error("No more mock responses");
        }
        return {
            ok: true,
            status: 200,
            text: async () => responses[callIndex++],
        };
    });
}

afterEach(() => {
    globalThis.fetch = originalFetch;
});

const baseConfig = {
    blz: "12345678",
    name: "testuser",
    pin: "12345",
    url: "https://banking.example.com/fints",
};

describe("NegotiatingClient", () => {
    describe("constructor", () => {
        it("creates with default v3.0 preference", () => {
            const client = new NegotiatingClient(baseConfig);
            expect(client.protocolVersion).toBeNull();
            expect(client.getV3Client()).toBeInstanceOf(PinTanClient);
            expect(client.getV4Client()).toBeNull();
        });

        it("creates v4 client when preferred version is 4.1", () => {
            const client = new NegotiatingClient({
                ...baseConfig,
                preferredVersion: "4.1",
            });
            expect(client.getV4Client()).toBeInstanceOf(FinTS4Client);
        });

        it("uses v4Url when provided", () => {
            const client = new NegotiatingClient({
                ...baseConfig,
                preferredVersion: "4.1",
                v4Url: "https://banking.example.com/fints4",
            });
            expect(client.getV4Client()).toBeInstanceOf(FinTS4Client);
        });
    });

    describe("detectVersion", () => {
        it("defaults to v3.0 when no preferred version", async () => {
            const client = new NegotiatingClient(baseConfig);
            const version = await client.detectVersion();
            expect(version).toBe("3.0");
        });

        it("falls back to v3.0 when v4.1 connection fails", async () => {
            mockFetchError();
            const client = new NegotiatingClient({
                ...baseConfig,
                preferredVersion: "4.1",
                // Use minimal retry settings to avoid timeout
                timeout: 100,
            });

            const version = await client.detectVersion();
            expect(version).toBe("3.0");
        }, 30000);

        it("caches the detected version", async () => {
            const client = new NegotiatingClient(baseConfig);

            const v1 = await client.detectVersion();
            const v2 = await client.detectVersion();
            expect(v1).toBe(v2);
        });
    });

    describe("forceVersion", () => {
        it("forces v3.0", () => {
            const client = new NegotiatingClient(baseConfig);
            client.forceVersion("3.0");
            expect(client.protocolVersion).toBe("3.0");
        });

        it("forces v4.1 and creates v4 client if needed", () => {
            const client = new NegotiatingClient(baseConfig);
            expect(client.getV4Client()).toBeNull();

            client.forceVersion("4.1");
            expect(client.protocolVersion).toBe("4.1");
            expect(client.getV4Client()).toBeInstanceOf(FinTS4Client);
        });

        it("does not recreate v4 client if already exists", () => {
            const client = new NegotiatingClient({
                ...baseConfig,
                preferredVersion: "4.1",
            });
            const v4Before = client.getV4Client();

            client.forceVersion("4.1");
            expect(client.getV4Client()).toBe(v4Before);
        });
    });

    describe("getV3Client", () => {
        it("returns the PinTanClient instance", () => {
            const client = new NegotiatingClient(baseConfig);
            expect(client.getV3Client()).toBeInstanceOf(PinTanClient);
        });
    });

    describe("getV4Client", () => {
        it("returns null when v4 is not configured", () => {
            const client = new NegotiatingClient(baseConfig);
            expect(client.getV4Client()).toBeNull();
        });

        it("returns FinTS4Client when v4 is configured", () => {
            const client = new NegotiatingClient({
                ...baseConfig,
                preferredVersion: "4.1",
            });
            expect(client.getV4Client()).toBeInstanceOf(FinTS4Client);
        });
    });
});
