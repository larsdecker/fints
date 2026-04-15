/**
 * Types specific to the FinTS 4.1 protocol.
 */
import { SEPAAccount, Balance, Statement, BankCapabilities } from "../types";
import { TanMethod } from "../tan-method";

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
    productId: string;
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
