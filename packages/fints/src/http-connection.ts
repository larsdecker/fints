import "isomorphic-fetch";
import { verbose } from "./logger";
import { encodeBase64, decodeBase64 } from "./utils";
import { Request } from "./request";
import { Response } from "./response";
import { Connection } from "./types";

/**
 * Configuration specifying how to reach the fints server.
 */
export class ConnectionConfig {
    /**
     * The URL to reach the server at.
     */
    public url: string;
    /**
     * If set to `true`, will log all requests performed and responses received.
     */
    public debug = false;
    /**
     * Timeout in milliseconds for HTTP requests. Default: 30000 (30 seconds)
     */
    public timeout = 30000;
    /**
     * Maximum number of retry attempts for failed requests. Default: 3
     */
    public maxRetries = 3;
    /**
     * Base delay in milliseconds for exponential backoff. Default: 1000 (1 second)
     */
    public retryDelay = 1000;
}

/**
 * A connection used by clients to reach the fints server.
 */
export class HttpConnection extends ConnectionConfig implements Connection {
    constructor(config: ConnectionConfig) {
        super();
        Object.assign(this, config);
    }

    public async send(request: Request): Promise<Response> {
        const { url } = this;
        verbose(`Sending Request: ${request}`);
        if (this.debug) { verbose(`Parsed Request:\n${request.debugString}`); }

        let lastError: Error | null = null;
        let attempt = 0;

        while (attempt <= this.maxRetries) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);

                try {
                    const httpRequest = await fetch(url, {
                        method: "POST",
                        body: encodeBase64(String(request)),
                        signal: controller.signal,
                    });

                    clearTimeout(timeoutId);

                    if (!httpRequest.ok) {
                        throw new Error(`Received bad status code ${httpRequest.status} from FinTS endpoint.`);
                    }

                    const responseString = decodeBase64(await httpRequest.text());
                    verbose(`Received Response: ${responseString}`);
                    const response = new Response(responseString);
                    if (this.debug) { verbose(`Parsed Response:\n${response.debugString}`); }
                    return response;
                } finally {
                    clearTimeout(timeoutId);
                }
            } catch (error) {
                lastError = error as Error;
                attempt++;

                // Check if error is due to timeout
                const isTimeout = error.name === "AbortError" || error.message?.includes("timeout");

                if (attempt <= this.maxRetries) {
                    // Calculate exponential backoff delay
                    const delay = this.retryDelay * Math.pow(2, attempt - 1);
                    verbose(`Request failed (attempt ${attempt}/${this.maxRetries + 1}), retrying in ${delay}ms: ${error.message}`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    // Max retries reached
                    if (isTimeout) {
                        throw new Error(`FinTS request timed out after ${this.maxRetries + 1} attempts (timeout: ${this.timeout}ms)`);
                    }
                    throw new Error(`FinTS request failed after ${this.maxRetries + 1} attempts: ${lastError.message}`);
                }
            }
        }

        // This should never be reached, but TypeScript needs it
        throw lastError || new Error("Unknown error during FinTS request");
    }
}
