import { FinTS4HttpConnection } from "../connection";

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

describe("FinTS4HttpConnection", () => {
    describe("constructor", () => {
        it("initializes with config values", () => {
            const conn = new FinTS4HttpConnection({
                url: "https://example.com/fints",
                debug: true,
                timeout: 5000,
                maxRetries: 2,
                retryDelay: 500,
            });

            // Connection is created without errors
            expect(conn).toBeDefined();
        });
    });

    describe("send", () => {
        it("sends XML request via HTTP POST", async () => {
            globalThis.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                text: async () => "<FinTSMessage><MsgHead><DialogID>d1</DialogID></MsgHead></FinTSMessage>",
            });

            const conn = new FinTS4HttpConnection({
                url: "https://example.com/fints",
            });

            const result = await conn.send("<FinTSMessage>test</FinTSMessage>");

            expect(result).toContain("<FinTSMessage>");
            expect(globalThis.fetch).toHaveBeenCalledWith(
                "https://example.com/fints",
                expect.objectContaining({
                    method: "POST",
                    body: "<FinTSMessage>test</FinTSMessage>",
                    headers: expect.objectContaining({
                        "Content-Type": "application/xml; charset=UTF-8",
                    }),
                }),
            );
        });

        it("sends request in debug mode", async () => {
            globalThis.fetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                text: async () => "<FinTSMessage/>",
            });

            const conn = new FinTS4HttpConnection({
                url: "https://example.com/fints",
                debug: true,
            });

            const result = await conn.send("<test/>");
            expect(result).toBe("<FinTSMessage/>");
        });

        it("throws on non-OK HTTP response after retries", async () => {
            globalThis.fetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 500,
            });

            const conn = new FinTS4HttpConnection({
                url: "https://example.com/fints",
                maxRetries: 0,
                retryDelay: 1,
            });

            await expect(conn.send("<test/>")).rejects.toThrow("Received bad status code 500");
        });

        it("retries on network error", async () => {
            let callCount = 0;
            globalThis.fetch = jest.fn().mockImplementation(async () => {
                callCount++;
                if (callCount <= 2) {
                    throw new Error("Network error");
                }
                return {
                    ok: true,
                    status: 200,
                    text: async () => "<response/>",
                };
            });

            const conn = new FinTS4HttpConnection({
                url: "https://example.com/fints",
                maxRetries: 3,
                retryDelay: 1,
            });

            const result = await conn.send("<test/>");
            expect(result).toBe("<response/>");
            expect(callCount).toBe(3);
        });

        it("throws after max retries exhausted", async () => {
            globalThis.fetch = jest.fn().mockRejectedValue(new Error("Persistent failure"));

            const conn = new FinTS4HttpConnection({
                url: "https://example.com/fints",
                maxRetries: 1,
                retryDelay: 1,
            });

            await expect(conn.send("<test/>")).rejects.toThrow(
                "FinTS 4.1: Request failed after 2 attempts",
            );
        });
    });
});
