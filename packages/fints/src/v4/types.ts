/**
 * Types specific to the FinTS 4.1 protocol.
 */
import { SEPAAccount, Balance } from "../types";
import { TanMethod } from "../tan-method";

/**
 * A TAN challenge issued by the server in a two-step TAN flow.
 * The server sends this when a transaction needs additional authentication.
 */
export interface TanChallenge {
    /** The text of the challenge to display to the user. */
    challengeText?: string;
    /** The server-issued transaction reference needed for TAN submission. */
    transactionReference: string;
    /** Optional HHD-encoded challenge data for chip-TAN devices. */
    challengeHhd?: string;
    /** Name of the TAN method that issued the challenge. */
    tanMethodName?: string;
    /** Time in seconds until the challenge expires (if provided by the bank). */
    challengeValidSeconds?: number;
}

/**
 * Callback invoked when the server requires a TAN to proceed.
 * The implementation should show the challenge to the user and return the TAN they enter.
 *
 * @example
 * ```typescript
 * const tanCallback: TanCallback = async (challenge) => {
 *   console.log(challenge.challengeText);        // "Please confirm: Transfer 100 EUR"
 *   return await promptUser("Enter TAN: ");       // user types their TAN
 * };
 * ```
 */
export type TanCallback = (challenge: TanChallenge) => Promise<string>;

/**
 * Configuration for a FinTS 4.1 dialog.
 */
export interface FinTS4DialogConfig {
    /** The bank's identification number (Bankleitzahl). */
    blz: string;
    /** The username or identification number. */
    name: string;
    /** The PIN code or password. */
    pin: string;
    /** System ID for the client. */
    systemId: string;
    /** Product registration ID. */
    productId?: string;
    /**
     * Callback invoked when the server issues a TAN challenge.
     * If not provided and a TAN is required, a `FinTS4TanRequiredError` is thrown.
     */
    tanCallback?: TanCallback;
}

/**
 * Configuration for the FinTS 4.1 client.
 */
export interface FinTS4ClientConfig {
    /** The bank's identification number (Bankleitzahl). */
    blz: string;
    /** The username or identification number. */
    name: string;
    /** The PIN code or password. */
    pin: string;
    /** The URL to reach the FinTS server. */
    url: string;
    /** Product registration ID. */
    productId?: string;
    /** If set to true, will log all requests and responses. */
    debug?: boolean;
    /** Timeout in milliseconds for HTTP requests. */
    timeout?: number;
    /** Maximum number of retry attempts. */
    maxRetries?: number;
    /** Base delay for retry backoff in milliseconds. */
    retryDelay?: number;
    /**
     * Callback invoked when the server issues a TAN challenge.
     * If not provided and a TAN is required, a `FinTS4TanRequiredError` is thrown.
     */
    tanCallback?: TanCallback;
    /**
     * Additional options passed directly to the underlying `fetch()` call.
     * Useful for providing a custom TLS agent in Node.js:
     * ```typescript
     * import https from "https";
     * const agent = new https.Agent({ rejectUnauthorized: false });
     * const client = new FinTS4Client({ ..., fetchOptions: { agent } });
     * ```
     */
    fetchOptions?: Record<string, unknown>;
    /**
     * TLS configuration for bank-specific certificate requirements (Node.js only).
     * Use `createTlsAgent(tlsOptions)` to create an agent and pass it via `fetchOptions`.
     */
    tlsOptions?: FinTS4TlsOptions;
    /**
     * Preferred HBCI protocol version string (e.g. "4.1", "4.0").
     * Defaults to "4.1". The client will negotiate downward if the bank rejects the preferred version.
     */
    preferredHbciVersion?: string;
}

/**
 * TLS configuration for FinTS 4.1 connections (Node.js only).
 */
export interface FinTS4TlsOptions {
    /**
     * Whether to reject connections with unauthorized (e.g. self-signed) certificates.
     * Defaults to `true`. Set to `false` only for testing — never in production.
     */
    rejectUnauthorized?: boolean;
    /**
     * Custom CA certificate(s) as PEM-encoded strings.
     * Use this when the bank uses a certificate signed by a private CA.
     */
    ca?: string | string[];
}

/**
 * The message header for a FinTS 4.1 XML message.
 */
export interface MsgHead {
    /** Message number within the dialog. */
    msgNo: number;
    /** The unique dialog identifier. */
    dialogId: string;
    /** The HBCI/FinTS protocol version. */
    hbciVersion: string;
}

/**
 * The message tail for a FinTS 4.1 XML message.
 */
export interface MsgTail {
    /** Message number (must match MsgHead). */
    msgNo: number;
}

/**
 * A parsed FinTS 4.1 XML response.
 */
export interface FinTS4Response {
    /** The dialog ID from the response. */
    dialogId: string;
    /** Message number from the response. */
    msgNo: number;
    /** Whether the response indicates success. */
    success: boolean;
    /** Return codes and messages. */
    returnValues: FinTS4ReturnValue[];
    /** System ID (from sync responses). */
    systemId?: string;
    /** Bank parameter data. */
    bpd?: BankParameterData;
    /** User parameter data. */
    upd?: UserParameterData;
    /** TAN methods supported by the server. */
    tanMethods?: TanMethod[];
    /** SEPA accounts. */
    accounts?: SEPAAccount[];
    /** Balance data. */
    balance?: Balance;
    /** Raw camt XML data for statement parsing. */
    camtData?: string;
    /** Raw MT535 data for holdings parsing. */
    mt535Data?: string;
    /** Supported HBCI versions. */
    supportedHbciVersions?: string[];
    /** Supported segment versions (segment type -> max version). */
    segmentVersions?: Map<string, number>;
    /** Pain formats supported by the server. */
    painFormats?: string[];
    /** Supported camt formats. */
    supportedCamtFormats?: string[];
    /** Touchdown token for pagination. */
    touchdown?: string;
    /** Raw parsed XML object for further processing. */
    rawXml?: unknown;
    /**
     * TAN challenge from the server. Present when the server requires strong customer
     * authentication (return code `0030`). Pass to the user and submit via `tanCallback`.
     */
    tanChallenge?: TanChallenge;
    /**
     * Whether the server requires a TAN to proceed (return code `0030`).
     * When `true` and `tanChallenge` is present, the dialog will automatically
     * handle the TAN flow if `tanCallback` is configured.
     */
    tanRequired?: boolean;
}

/**
 * A single return value from a FinTS 4.1 response.
 */
export interface FinTS4ReturnValue {
    /** The return code (e.g., "0010" for success). */
    code: string;
    /** Human-readable message. */
    message: string;
    /** Whether this is an error code. */
    isError: boolean;
    /** Additional parameters. */
    parameters?: string[];
}

/**
 * Bank Parameter Data (BPD) from a FinTS 4.1 synchronization response.
 */
export interface BankParameterData {
    /** The bank's name. */
    bankName?: string;
    /** BPD version number. */
    bpdVersion?: number;
    /** Supported HBCI/FinTS versions. */
    supportedVersions?: string[];
    /** Maximum number of business transactions per message. */
    maxTransactionsPerMsg?: number;
    /** Supported languages. */
    supportedLanguages?: string[];
    /** Supported security methods. */
    supportedSecurityMethods?: string[];
    /** Segment capabilities (segment type -> max version). */
    segmentVersions?: Map<string, number>;
    /** Supported pain formats. */
    painFormats?: string[];
    /** Supported camt formats. */
    camtFormats?: string[];
    /** Minimum number of signatures required for balance queries. */
    minSignaturesBalance?: number;
    /** Minimum number of signatures required for account statements. */
    minSignaturesStatement?: number;
    /** Negotiated HBCI version (highest version supported by both client and server). */
    negotiatedVersion?: string;
}

/**
 * User Parameter Data (UPD) from a FinTS 4.1 response.
 */
export interface UserParameterData {
    /** UPD version number. */
    updVersion?: number;
    /** User's accounts with access permissions. */
    accounts?: UserAccount[];
}

/**
 * An account as described in User Parameter Data.
 */
export interface UserAccount {
    /** IBAN of the account. */
    iban: string;
    /** BIC of the account. */
    bic?: string;
    /** Account number (legacy). */
    accountNumber?: string;
    /** BLZ (legacy). */
    blz?: string;
    /** Account owner name. */
    ownerName?: string;
    /** Account name/description. */
    accountName?: string;
    /** Allowed transaction types. */
    allowedTransactions?: string[];
}

/**
 * A parsed camt.053 statement entry.
 */
export interface CamtEntry {
    /** Entry reference. */
    entryReference?: string;
    /** Amount of the entry. */
    amount: number;
    /** Currency code. */
    currency: string;
    /** Credit or Debit indicator. */
    creditDebitIndicator: "CRDT" | "DBIT";
    /** Booking date. */
    bookingDate?: Date;
    /** Value date. */
    valueDate?: Date;
    /** Remittance information / payment purpose. */
    remittanceInformation?: string;
    /** Creditor/Debtor name. */
    counterpartyName?: string;
    /** Creditor/Debtor IBAN. */
    counterpartyIban?: string;
    /** Creditor/Debtor BIC. */
    counterpartyBic?: string;
    /** End-to-end reference. */
    endToEndReference?: string;
    /** Mandate reference. */
    mandateReference?: string;
    /** Bank transaction code. */
    bankTransactionCode?: string;
}

/**
 * A parsed camt.053 statement.
 */
export interface CamtStatement {
    /** Statement ID. */
    id: string;
    /** Account IBAN. */
    iban?: string;
    /** Statement creation date. */
    creationDate?: Date;
    /** Opening balance. */
    openingBalance?: number;
    /** Closing balance. */
    closingBalance?: number;
    /** Currency. */
    currency?: string;
    /** Statement entries (transactions). */
    entries: CamtEntry[];
}

/**
 * Connection interface for FinTS 4.1.
 */
export interface FinTS4Connection {
    /**
     * Send an XML request and receive an XML response.
     */
    send(xmlRequest: string): Promise<string>;
}
