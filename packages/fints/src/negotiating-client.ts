/**
 * NegotiatingClient - Automatic FinTS protocol version negotiation.
 *
 * This client automatically detects whether the bank supports FinTS 4.1
 * and falls back to FinTS 3.0 if not. It provides a unified API regardless
 * of the underlying protocol version.
 *
 * **Negotiation Strategy:**
 * 1. First attempt connection with FinTS 3.0 (the more common protocol)
 * 2. During synchronization, check if the bank advertises FinTS 4.1 support
 * 3. If FinTS 4.1 is supported and preferred, switch to v4.1 client
 * 4. If FinTS 4.1 connection fails, fall back to v3.0
 *
 * Usage:
 * ```typescript
 * const client = new NegotiatingClient({
 *   blz: "12345678",
 *   name: "username",
 *   pin: "12345",
 *   url: "https://banking.example.com/fints",
 * });
 *
 * // Automatically uses the best available protocol version
 * const accounts = await client.accounts();
 * const statements = await client.statements(accounts[0]);
 * ```
 */
import { PinTanClient, PinTanClientConfig } from "./pin-tan-client";
import { FinTS4Client } from "./v4/client";
import { FinTS4ClientConfig } from "./v4/types";
import { SEPAAccount, Balance, Statement, BankCapabilities } from "./types";
import { verbose } from "./logger";

/**
 * Detected FinTS protocol version.
 */
export type FinTSProtocolVersion = "3.0" | "4.1";

/**
 * Configuration for the negotiating client.
 */
export interface NegotiatingClientConfig extends PinTanClientConfig {
    /**
     * Preferred protocol version.
     * If set to "4.1", will try FinTS 4.1 first and fall back to 3.0.
     * If set to "3.0", will only use FinTS 3.0.
     * Default: "3.0" (for maximum compatibility)
     */
    preferredVersion?: FinTSProtocolVersion;

    /**
     * URL for the FinTS 4.1 endpoint.
     * Some banks use a different endpoint for v4.1.
     * If not provided, uses the same URL as for v3.0.
     */
    v4Url?: string;
}

/**
 * A client that automatically negotiates the FinTS protocol version.
 *
 * This provides a unified interface for both FinTS 3.0 and 4.1, automatically
 * selecting the best available protocol version based on server capabilities.
 */
export class NegotiatingClient {
    private config: NegotiatingClientConfig;
    private v3Client: PinTanClient;
    private v4Client: FinTS4Client | null = null;
    private detectedVersion: FinTSProtocolVersion | null = null;

    constructor(config: NegotiatingClientConfig) {
        this.config = config;
        this.v3Client = new PinTanClient(config);

        if (config.preferredVersion === "4.1") {
            const v4Config: FinTS4ClientConfig = {
                blz: config.blz,
                name: config.name,
                pin: config.pin,
                url: config.v4Url || config.url,
                productId: config.productId,
                debug: config.debug,
                timeout: config.timeout,
            };
            this.v4Client = new FinTS4Client(v4Config);
        }
    }

    /**
     * Get the detected/active protocol version.
     * Returns null if no connection has been established yet.
     */
    public get protocolVersion(): FinTSProtocolVersion | null {
        return this.detectedVersion;
    }

    /**
     * Detect the supported protocol version by attempting to connect.
     *
     * @returns The detected protocol version.
     */
    public async detectVersion(): Promise<FinTSProtocolVersion> {
        if (this.detectedVersion) {
            return this.detectedVersion;
        }

        if (this.config.preferredVersion === "4.1" && this.v4Client) {
            try {
                verbose("NegotiatingClient: Attempting FinTS 4.1 connection...");
                await this.v4Client.capabilities();
                this.detectedVersion = "4.1";
                verbose("NegotiatingClient: FinTS 4.1 connection successful.");
                return "4.1";
            } catch (error) {
                verbose(
                    `NegotiatingClient: FinTS 4.1 failed, falling back to 3.0: ${(error as Error).message}`,
                );
            }
        }

        this.detectedVersion = "3.0";
        verbose("NegotiatingClient: Using FinTS 3.0.");
        return "3.0";
    }

    /**
     * Retrieve the capabilities of the bank.
     */
    public async capabilities(): Promise<BankCapabilities> {
        const version = await this.detectVersion();
        if (version === "4.1" && this.v4Client) {
            return this.v4Client.capabilities();
        }
        return this.v3Client.capabilities();
    }

    /**
     * Fetch a list of all SEPA accounts.
     */
    public async accounts(): Promise<SEPAAccount[]> {
        const version = await this.detectVersion();
        if (version === "4.1" && this.v4Client) {
            return this.v4Client.accounts();
        }
        return this.v3Client.accounts();
    }

    /**
     * Fetch the balance for a SEPA account.
     */
    public async balance(account: SEPAAccount): Promise<Balance> {
        const version = await this.detectVersion();
        if (version === "4.1" && this.v4Client) {
            return this.v4Client.balance(account);
        }
        return this.v3Client.balance(account);
    }

    /**
     * Fetch account statements.
     *
     * When using FinTS 4.1, statements are fetched in camt.053 format and
     * converted to the common Statement format for backward compatibility.
     */
    public async statements(
        account: SEPAAccount,
        startDate?: Date,
        endDate?: Date,
    ): Promise<Statement[]> {
        const version = await this.detectVersion();
        if (version === "4.1" && this.v4Client) {
            return this.v4Client.statements(account, startDate, endDate);
        }
        return this.v3Client.statements(account, startDate, endDate);
    }

    /**
     * Force using a specific protocol version.
     * Useful when you know which version the bank supports.
     */
    public forceVersion(version: FinTSProtocolVersion): void {
        this.detectedVersion = version;
        if (version === "4.1" && !this.v4Client) {
            const v4Config: FinTS4ClientConfig = {
                blz: this.config.blz,
                name: this.config.name,
                pin: this.config.pin,
                url: this.config.v4Url || this.config.url,
                productId: this.config.productId,
                debug: this.config.debug,
                timeout: this.config.timeout,
            };
            this.v4Client = new FinTS4Client(v4Config);
        }
    }

    /**
     * Get the underlying v3.0 client.
     * Useful for operations only supported in v3.0 (e.g., credit transfers).
     */
    public getV3Client(): PinTanClient {
        return this.v3Client;
    }

    /**
     * Get the underlying v4.1 client.
     * Returns null if v4.1 is not configured.
     */
    public getV4Client(): FinTS4Client | null {
        return this.v4Client;
    }
}
