/**
 * FinTS Test Server - HTTP server implementation.
 *
 * Provides an HTTP endpoint that accepts FinTS protocol messages
 * encoded in Base64, processes them, and returns Base64-encoded responses.
 *
 * This follows the FinTS 3.0 transport specification:
 * - HTTP POST with Base64-encoded body
 * - Content-Type: application/x-www-form-urlencoded (or text/plain)
 * - Response is Base64-encoded FinTS message
 *
 * Reference: FinTS 3.0 specification section H (transport)
 */
import * as http from "http";
import { FinTSRequestHandler } from "./request-handler";
import { FinTSTestConfig, createDefaultConfig } from "./test-data";
import { encodeBase64, decodeBase64 } from "./protocol";

export interface FinTSServerOptions {
    /** Port to listen on (default: 0 for random available port) */
    port?: number;
    /** Hostname to bind to (default: "127.0.0.1") */
    host?: string;
    /** Test configuration */
    config?: FinTSTestConfig;
    /** Enable verbose logging */
    verbose?: boolean;
}

/**
 * FinTS Test Server.
 *
 * A mock FinTS banking server for integration testing.
 * Accepts FinTS 3.0 protocol messages over HTTP and returns
 * valid responses for all major banking operations.
 *
 * Supported operations:
 * - HKSYN: Synchronization (system ID, BPD, TAN methods)
 * - HKIDN/HKVVB: Dialog initialization with PIN/TAN authentication
 * - HKSPA: SEPA account listing
 * - HKSAL: Account balance queries
 * - HKKAZ: Transaction statements (MT940 format)
 * - HKCDB: Standing orders listing
 * - HKCCS: SEPA credit transfers
 * - HKDSE: SEPA direct debits
 * - HKTAN: TAN challenge/response handling
 * - HKEND: Dialog termination
 *
 * @example
 * ```typescript
 * const server = new FinTSServer({ port: 3000 });
 * await server.start();
 * console.log(`FinTS server running at ${server.url}`);
 *
 * // Use with PinTanClient
 * const client = new PinTanClient({
 *     blz: "12345678",
 *     name: "testuser",
 *     pin: "12345",
 *     url: server.url,
 * });
 * const accounts = await client.accounts();
 *
 * await server.stop();
 * ```
 */
export class FinTSServer {
    private server: http.Server | null = null;
    private handler: FinTSRequestHandler;
    private port: number;
    private host: string;
    private verbose: boolean;
    private config: FinTSTestConfig;
    private resolvedPort: number | null = null;

    constructor(options: FinTSServerOptions = {}) {
        this.port = options.port || 0;
        this.host = options.host || "127.0.0.1";
        this.verbose = options.verbose || false;
        this.config = options.config || createDefaultConfig();
        this.handler = new FinTSRequestHandler(this.config);
    }

    /**
     * Start the server and return a promise that resolves when the server is listening.
     */
    public async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                this.handleRequest(req, res);
            });

            this.server.on("error", reject);

            this.server.listen(this.port, this.host, () => {
                const address = this.server!.address();
                if (typeof address === "object" && address !== null) {
                    this.resolvedPort = address.port;
                }
                if (this.verbose) {
                    console.log(`FinTS test server listening on ${this.url}`);
                }
                resolve();
            });
        });
    }

    /**
     * Stop the server.
     */
    public async stop(): Promise<void> {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    this.server = null;
                    this.resolvedPort = null;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Get the server's URL.
     */
    public get url(): string {
        const port = this.resolvedPort || this.port;
        return `http://${this.host}:${port}/fints`;
    }

    /**
     * Get the current configuration.
     */
    public getConfig(): FinTSTestConfig {
        return this.config;
    }

    /**
     * Update the configuration.
     */
    public setConfig(config: Partial<FinTSTestConfig>): void {
        this.config = { ...this.config, ...config };
        this.handler = new FinTSRequestHandler(this.config);
    }

    /**
     * Reset server state (clear all dialog sessions).
     */
    public reset(): void {
        this.handler.reset();
    }

    /**
     * Handle an incoming HTTP request.
     */
    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
        // Only accept POST
        if (req.method !== "POST") {
            res.writeHead(405, { "Content-Type": "text/plain" });
            res.end("Method Not Allowed");
            return;
        }

        let body = "";
        req.on("data", (chunk: Buffer | string) => {
            body += chunk.toString();
        });

        req.on("end", () => {
            try {
                // Decode the Base64 request
                const requestStr = decodeBase64(body);

                if (this.verbose) {
                    console.log("\n--- Incoming Request ---");
                    console.log(requestStr.substring(0, 500));
                    console.log("...");
                }

                // Process the FinTS message
                const responseStr = this.handler.processMessage(requestStr);

                if (this.verbose) {
                    console.log("\n--- Outgoing Response ---");
                    console.log(responseStr.substring(0, 500));
                    console.log("...");
                }

                // Encode the response
                const responseBase64 = encodeBase64(responseStr);

                res.writeHead(200, {
                    "Content-Type": "text/plain",
                    "Content-Length": Buffer.byteLength(responseBase64),
                });
                res.end(responseBase64);
            } catch (error) {
                if (this.verbose) {
                    console.error("Error processing request:", error);
                }
                res.writeHead(500, { "Content-Type": "text/plain" });
                res.end("Internal Server Error");
            }
        });
    }
}
