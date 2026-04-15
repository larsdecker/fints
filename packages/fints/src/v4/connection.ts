/**
 * FinTS 4.1 HTTP connection.
 *
 * Handles sending XML requests to FinTS 4.1 servers over HTTP.
 * Unlike FinTS 3.0 which uses Base64-encoded proprietary format,
 * FinTS 4.1 uses XML over HTTP POST.
 */
import "isomorphic-fetch";
import { FinTS4Connection, FinTS4TlsOptions } from "./types";
import { verbose } from "../logger";

/**
 * Configuration for a FinTS 4.1 HTTP connection.
 */
export interface FinTS4ConnectionConfig {
    /** The URL of the FinTS server. */
    url: string;
    /** Whether to log requests/responses. */
    debug?: boolean;
    /** Request timeout in milliseconds. */
    timeout?: number;
    /** Maximum retry attempts. */
    maxRetries?: number;
    /** Base delay for exponential backoff in ms. */
    retryDelay?: number;
    /**
     * Additional options forwarded to `fetch()` on every request.
     * In Node.js, use this to pass a custom `https.Agent`:
     * ```typescript
     * import https from "https";
     * const agent = new https.Agent({ rejectUnauthorized: false });
     * new FinTS4HttpConnection({ url, fetchOptions: { agent } });
     * ```
     */
    fetchOptions?: Record<string, unknown>;
}

/**
 * Create an `https.Agent` for Node.js with the given TLS options.
 *
 * Pass the returned agent via `fetchOptions.agent` when constructing
 * `FinTS4HttpConnection` or `FinTS4ClientConfig`:
 *
 * ```typescript
 * const agent = createTlsAgent({ rejectUnauthorized: false }); // dev only!
 * const client = new FinTS4Client({ ..., fetchOptions: { agent } });
 * ```
 *
 * This function throws if called outside a Node.js environment.
 */
export function createTlsAgent(options: FinTS4TlsOptions): unknown {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const https = require("https") as typeof import("https");
    return new https.Agent({
        rejectUnauthorized: options.rejectUnauthorized ?? true,
        ...(options.ca ? { ca: options.ca } : {}),
    });
}

/**
 * HTTP connection for FinTS 4.1 XML-based communication.
 */
export class FinTS4HttpConnection implements FinTS4Connection {
    private url: string;
    private debug: boolean;
    private timeout: number;
    private maxRetries: number;
    private retryDelay: number;
    private fetchOptions: Record<string, unknown>;

    constructor(config: FinTS4ConnectionConfig) {
        this.url = config.url;
        this.debug = config.debug ?? false;
        this.timeout = config.timeout ?? 30000;
        this.maxRetries = config.maxRetries ?? 3;
        this.retryDelay = config.retryDelay ?? 1000;
        this.fetchOptions = config.fetchOptions ?? {};
    }

    /**
     * Send an XML request string and return the XML response string.
     */
    public async send(xmlRequest: string): Promise<string> {
        verbose(`FinTS 4.1: Sending request to ${this.url}`);
        if (this.debug) {
            verbose(`FinTS 4.1 Request XML:\n${xmlRequest}`);
        }

        let lastError: Error | null = null;
        let attempt = 0;

        while (attempt <= this.maxRetries) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);

                try {
                    const httpResponse = await fetch(this.url, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/xml; charset=UTF-8",
                            Accept: "application/xml",
                        },
                        body: xmlRequest,
                        signal: controller.signal,
                        ...this.fetchOptions,
                    });

                    if (!httpResponse.ok) {
                        throw new Error(`FinTS 4.1: Received bad status code ${httpResponse.status} from endpoint.`);
                    }

                    const responseText = await httpResponse.text();
                    verbose(`FinTS 4.1: Received response`);
                    if (this.debug) {
                        verbose(`FinTS 4.1 Response XML:\n${responseText}`);
                    }
                    return responseText;
                } finally {
                    clearTimeout(timeoutId);
                }
            } catch (error) {
                lastError = error as Error;
                attempt++;

                const isTimeout = (error as Error).name === "AbortError";

                if (attempt <= this.maxRetries) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1);
                    verbose(
                        `FinTS 4.1: Request failed (attempt ${attempt}/${this.maxRetries + 1}), ` +
                            `retrying in ${delay}ms: ${(error as Error).message}`,
                    );
                    await new Promise((resolve) => setTimeout(resolve, delay));
                } else {
                    if (isTimeout) {
                        throw new Error(
                            `FinTS 4.1: Request timed out after ${this.maxRetries + 1} attempts ` +
                                `(timeout: ${this.timeout}ms)`,
                        );
                    }
                    throw new Error(
                        `FinTS 4.1: Request failed after ${this.maxRetries + 1} attempts: ` + `${lastError.message}`,
                    );
                }
            }
        }

        throw lastError || new Error("Unknown error during FinTS 4.1 request");
    }
}
