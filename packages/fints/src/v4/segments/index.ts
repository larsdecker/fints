/**
 * FinTS 4.1 XML segment builders.
 *
 * These functions create the XML content for various FinTS 4.1 business segments.
 */
import { XmlSegment, xmlElement, escapeXml } from "../xml-builder";
import { FINTS_VERSION, COUNTRY_CODE } from "../constants";
import { PRODUCT_NAME, PRODUCT_VERSION } from "../../constants";
import { SEPAAccount } from "../../types";

/**
 * Build a DialogInit segment for initializing a dialog.
 */
export function buildDialogInitSegment(options: {
    segNo: number;
    blz: string;
    name: string;
    systemId: string;
    productId?: string;
    hbciVersion?: string;
}): XmlSegment {
    const productId = options.productId || PRODUCT_NAME;
    const hbciVersion = options.hbciVersion || FINTS_VERSION;
    const body =
        xmlElement("BLZ", options.blz) +
        xmlElement("CountryCode", COUNTRY_CODE) +
        xmlElement("CustomerID", escapeXml(options.name)) +
        xmlElement("SystemID", escapeXml(options.systemId)) +
        xmlElement("Product", xmlElement("Name", escapeXml(productId)) + xmlElement("Version", PRODUCT_VERSION)) +
        xmlElement("HBCIVersion", hbciVersion);

    return {
        type: "DialogInit",
        version: 1,
        segNo: options.segNo,
        body,
    };
}

/**
 * Build a DialogEnd segment for terminating a dialog.
 */
export function buildDialogEndSegment(options: { segNo: number; dialogId: string }): XmlSegment {
    return {
        type: "DialogEnd",
        version: 1,
        segNo: options.segNo,
        body: xmlElement("DialogID", escapeXml(options.dialogId)),
    };
}

/**
 * Build a Sync segment for synchronization (obtaining system ID, BPD, UPD).
 */
export function buildSyncSegment(options: { segNo: number; mode?: number }): XmlSegment {
    const mode = options.mode ?? 0;
    return {
        type: "Sync",
        version: 1,
        segNo: options.segNo,
        body: xmlElement("SyncMode", String(mode)),
    };
}

/**
 * Build an account list request segment (equivalent to HKSPA in v3).
 */
export function buildAccountListSegment(options: { segNo: number }): XmlSegment {
    return {
        type: "AccountList",
        version: 1,
        segNo: options.segNo,
        body: xmlElement("AllAccounts", "true"),
    };
}

/**
 * Build a balance request segment (equivalent to HKSAL in v3).
 */
export function buildBalanceSegment(options: { segNo: number; version: number; account: SEPAAccount }): XmlSegment {
    const accountXml =
        xmlElement("IBAN", escapeXml(options.account.iban)) +
        xmlElement("BIC", escapeXml(options.account.bic)) +
        xmlElement("AccountNumber", escapeXml(options.account.accountNumber)) +
        xmlElement("BLZ", escapeXml(options.account.blz));

    return {
        type: "Balance",
        version: options.version,
        segNo: options.segNo,
        body: xmlElement("Account", accountXml),
    };
}

/**
 * Build an account statement request segment (HKCAZ - camt-based account statement).
 */
export function buildAccountStatementSegment(options: {
    segNo: number;
    version: number;
    account: SEPAAccount;
    startDate?: Date;
    endDate?: Date;
    camtFormat?: string;
    touchdown?: string;
}): XmlSegment {
    const accountXml =
        xmlElement("IBAN", escapeXml(options.account.iban)) +
        xmlElement("BIC", escapeXml(options.account.bic)) +
        xmlElement("AccountNumber", escapeXml(options.account.accountNumber)) +
        xmlElement("BLZ", escapeXml(options.account.blz));

    let body = xmlElement("Account", accountXml);

    if (options.startDate) {
        body += xmlElement("StartDate", formatDate(options.startDate));
    }
    if (options.endDate) {
        body += xmlElement("EndDate", formatDate(options.endDate));
    }

    const camtFormat = options.camtFormat || "urn:iso:std:iso:20022:tech:xsd:camt.053.001.02";
    body += xmlElement("CamtFormat", camtFormat);

    if (options.touchdown) {
        body += xmlElement("Touchdown", escapeXml(options.touchdown));
    }

    return {
        type: "AccountStatement",
        version: options.version,
        segNo: options.segNo,
        body,
    };
}

/**
 * Build a TAN request segment for v4.1.
 */
export function buildTanSegment(options: {
    segNo: number;
    version: number;
    process: string;
    segmentReference?: string;
    medium?: string;
    aref?: string;
}): XmlSegment {
    let body = xmlElement("TANProcess", options.process);

    if (options.segmentReference) {
        body += xmlElement("SegmentReference", escapeXml(options.segmentReference));
    }
    if (options.medium) {
        body += xmlElement("TANMedium", escapeXml(options.medium));
    }
    if (options.aref) {
        body += xmlElement("TransactionReference", escapeXml(options.aref));
    }

    return {
        type: "TAN",
        version: options.version,
        segNo: options.segNo,
        body,
    };
}

/**
 * Format a Date object as YYYY-MM-DD string.
 */
function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

/**
 * Build a holdings request segment (equivalent to HKWPD in v3).
 *
 * Requests the depot statement (Depotaufstellung) for a securities account.
 */
export function buildHoldingsSegment(options: {
    segNo: number;
    version: number;
    account: SEPAAccount;
    touchdown?: string;
}): XmlSegment {
    const accountXml =
        xmlElement("IBAN", escapeXml(options.account.iban)) +
        xmlElement("BIC", escapeXml(options.account.bic)) +
        xmlElement("AccountNumber", escapeXml(options.account.accountNumber)) +
        xmlElement("BLZ", escapeXml(options.account.blz));

    let body = xmlElement("Account", accountXml);

    if (options.touchdown) {
        body += xmlElement("Touchdown", escapeXml(options.touchdown));
    }

    return {
        type: "Holdings",
        version: options.version,
        segNo: options.segNo,
        body,
    };
}

/**
 * Build a TAN submission segment for the two-step TAN flow (process 2).
 *
 * Use this after receiving a TAN challenge (return code `0030`) to submit the
 * user-entered TAN. Include the TAN value itself in the message via `options.tan`
 * in `dialog.send()`.
 */
export function buildTanSubmitSegment(options: {
    segNo: number;
    version: number;
    transactionReference: string;
}): XmlSegment {
    return {
        type: "TAN",
        version: options.version,
        segNo: options.segNo,
        body:
            xmlElement("TANProcess", "2") + xmlElement("TransactionReference", escapeXml(options.transactionReference)),
    };
}
