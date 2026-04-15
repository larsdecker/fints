/**
 * Parser for ISO 20022 camt.053 (Bank-to-Customer Statement) XML format.
 *
 * This parser extracts transaction data from camt.053 XML responses
 * as returned by FinTS 4.1 servers for account statement requests.
 */
import { XMLParser } from "fast-xml-parser";
import { CamtStatement, CamtEntry } from "./types";
import { ensureArray, getXmlValue, getXmlString } from "./xml-parser";

/**
 * Parser options for camt XML.
 */
const camtParserOptions = {
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
    isArray: (name: string) => {
        return ["Stmt", "Ntry", "TxDtls", "Ustrd", "Bal"].includes(name);
    },
};

/**
 * Parse a date string (YYYY-MM-DD) into a Date object.
 */
function parseDate(dateStr: string | undefined): Date | undefined {
    if (!dateStr) return undefined;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? undefined : date;
}

/**
 * Parse the amount from a camt entry.
 * The amount node has text content and a Ccy attribute.
 */
function parseAmount(amtNode: unknown): { amount: number; currency: string } {
    if (amtNode == null) {
        return { amount: 0, currency: "EUR" };
    }

    if (typeof amtNode === "object") {
        const obj = amtNode as Record<string, unknown>;
        // fast-xml-parser represents element text as "#text" when attributes exist.
        // "Amt" and "InstdAmt" are alternative amount field names in different
        // ISO 20022 camt format versions (camt.053.001.02 vs camt.053.001.08).
        const text = obj["#text"] ?? obj["Amt"] ?? obj["InstdAmt"] ?? "";
        const ccy = (obj["@_Ccy"] as string) || "EUR";
        return {
            amount: parseFloat(String(text)) || 0,
            currency: ccy,
        };
    }

    return {
        amount: parseFloat(String(amtNode)) || 0,
        currency: "EUR",
    };
}

/**
 * Parse a single camt entry (Ntry element).
 */
function parseCamtEntry(entry: Record<string, unknown>): CamtEntry {
    const { amount, currency } = parseAmount(getXmlValue(entry, "Amt"));

    const creditDebitIndicator = getXmlString(entry, "CdtDbtInd") === "DBIT" ? "DBIT" : "CRDT";

    // Booking date
    const bookingDate = parseDate(getXmlString(entry, "BookgDt.Dt") || getXmlString(entry, "BookgDt.DtTm"));

    // Value date
    const valueDate = parseDate(getXmlString(entry, "ValDt.Dt") || getXmlString(entry, "ValDt.DtTm"));

    // Transaction details - usually nested under NtryDtls/TxDtls
    const txDtls = ensureArray(getXmlValue(entry, "NtryDtls.TxDtls") as Record<string, unknown>[]);
    const firstTx = txDtls[0];

    let remittanceInformation: string | undefined;
    let counterpartyName: string | undefined;
    let counterpartyIban: string | undefined;
    let counterpartyBic: string | undefined;
    let endToEndReference: string | undefined;
    let mandateReference: string | undefined;

    if (firstTx) {
        // Remittance information
        const rmtInfUstrd = getXmlValue(firstTx, "RmtInf.Ustrd");
        if (rmtInfUstrd != null) {
            const ustrdArr = ensureArray(rmtInfUstrd as string[]);
            remittanceInformation = ustrdArr.map(String).join(" ");
        }

        // Counterparty (Related Parties)
        // For credit entries, counterparty is the debtor; for debit entries, it's the creditor
        if (creditDebitIndicator === "CRDT") {
            counterpartyName = getXmlString(firstTx, "RltdPties.Dbtr.Nm");
            counterpartyIban = getXmlString(firstTx, "RltdPties.DbtrAcct.Id.IBAN");
            counterpartyBic =
                getXmlString(firstTx, "RltdAgts.DbtrAgt.FinInstnId.BIC") ||
                getXmlString(firstTx, "RltdAgts.DbtrAgt.FinInstnId.BICFI");
        } else {
            counterpartyName = getXmlString(firstTx, "RltdPties.Cdtr.Nm");
            counterpartyIban = getXmlString(firstTx, "RltdPties.CdtrAcct.Id.IBAN");
            counterpartyBic =
                getXmlString(firstTx, "RltdAgts.CdtrAgt.FinInstnId.BIC") ||
                getXmlString(firstTx, "RltdAgts.CdtrAgt.FinInstnId.BICFI");
        }

        // References
        endToEndReference = getXmlString(firstTx, "Refs.EndToEndId");
        mandateReference = getXmlString(firstTx, "Refs.MndtId");
    }

    // Bank transaction code
    const bankTransactionCode = getXmlString(entry, "BkTxCd.Domn.Cd");

    return {
        entryReference: getXmlString(entry, "NtryRef"),
        amount: creditDebitIndicator === "DBIT" ? -amount : amount,
        currency,
        creditDebitIndicator,
        bookingDate,
        valueDate,
        remittanceInformation,
        counterpartyName,
        counterpartyIban,
        counterpartyBic,
        endToEndReference,
        mandateReference,
        bankTransactionCode,
    };
}

/**
 * Parse a single camt statement (Stmt element).
 */
function parseCamtStatement(stmt: Record<string, unknown>): CamtStatement {
    const entries = ensureArray(getXmlValue(stmt, "Ntry") as Record<string, unknown>[]);

    // Opening balance
    const balances = ensureArray(getXmlValue(stmt, "Bal") as Record<string, unknown>[]);
    let openingBalance: number | undefined;
    let closingBalance: number | undefined;
    let currency: string | undefined;

    for (const bal of balances) {
        const balType = getXmlString(bal, "Tp.CdOrPrtry.Cd");
        const { amount, currency: balCcy } = parseAmount(getXmlValue(bal, "Amt"));
        const cdtDbt = getXmlString(bal, "CdtDbtInd");
        const signedAmount = cdtDbt === "DBIT" ? -amount : amount;
        currency = balCcy;

        if (balType === "OPBD" || balType === "PRCD") {
            openingBalance = signedAmount;
        } else if (balType === "CLBD" || balType === "CLAV") {
            closingBalance = signedAmount;
        }
    }

    return {
        id: getXmlString(stmt, "Id") || "",
        iban: getXmlString(stmt, "Acct.Id.IBAN"),
        creationDate: parseDate(getXmlString(stmt, "CreDtTm")),
        openingBalance,
        closingBalance,
        currency,
        entries: entries.map(parseCamtEntry),
    };
}

/**
 * Parse a complete camt.053 XML document.
 *
 * @param xmlString The raw camt.053 XML string.
 * @returns An array of parsed statements.
 */
export function parseCamt053(xmlString: string): CamtStatement[] {
    if (!xmlString || xmlString.trim().length === 0) {
        return [];
    }

    const parser = new XMLParser(camtParserOptions);
    const parsed = parser.parse(xmlString);

    // Navigate to the statement level:
    // Document > BkToCstmrStmt > Stmt
    const doc = parsed.Document || parsed;
    const bkToCstmrStmt = doc.BkToCstmrStmt || doc;
    const statements = ensureArray(bkToCstmrStmt.Stmt as Record<string, unknown>[]);

    return statements.map(parseCamtStatement);
}

/**
 * Parse camt.052 (Account Report) - similar structure to camt.053.
 *
 * @param xmlString The raw camt.052 XML string.
 * @returns An array of parsed statements.
 */
export function parseCamt052(xmlString: string): CamtStatement[] {
    if (!xmlString || xmlString.trim().length === 0) {
        return [];
    }

    const parser = new XMLParser(camtParserOptions);
    const parsed = parser.parse(xmlString);

    // Document > BkToCstmrAcctRpt > Rpt
    const doc = parsed.Document || parsed;
    const report = doc.BkToCstmrAcctRpt || doc;
    const reports = ensureArray((report.Rpt || report.Stmt) as Record<string, unknown>[]);

    return reports.map(parseCamtStatement);
}
