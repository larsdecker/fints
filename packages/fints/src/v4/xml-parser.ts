/**
 * XML response parser for FinTS 4.1 protocol.
 *
 * Parses XML responses from FinTS 4.1 servers into structured objects.
 */
import { XMLParser } from "fast-xml-parser";
import {
    FinTS4Response,
    FinTS4ReturnValue,
    BankParameterData,
    UserParameterData,
    UserAccount,
    TanChallenge,
} from "./types";
import { TanMethod } from "../tan-method";
import { SEPAAccount } from "../types";

/**
 * Parser options for fast-xml-parser.
 */
const parserOptions = {
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
    isArray: (name: string) => {
        // These elements can occur multiple times
        return [
            "Segment",
            "ReturnValue",
            "Account",
            "TANMethod",
            "Version",
            "Language",
            "SecurityMethod",
            "PainFormat",
            "CamtFormat",
            "Transaction",
            "Entry",
            "Ntry",
            "Stmt",
        ].includes(name);
    },
};

/**
 * Create a configured XML parser instance.
 */
function createParser(): XMLParser {
    return new XMLParser(parserOptions);
}

/**
 * Safely access a nested XML property using a dot-separated path.
 */
export function getXmlValue(obj: unknown, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;
    for (const part of parts) {
        if (current == null || typeof current !== "object") return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

/**
 * Get a string value from an XML object at the given path.
 */
export function getXmlString(obj: unknown, path: string): string | undefined {
    const value = getXmlValue(obj, path);
    if (value == null) return undefined;
    return String(value);
}

/**
 * Get a number value from an XML object at the given path.
 */
export function getXmlNumber(obj: unknown, path: string): number | undefined {
    const value = getXmlValue(obj, path);
    if (value == null) return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
}

/**
 * Ensure a value is an array.
 */
export function ensureArray<T>(value: T | T[] | undefined | null): T[] {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
}

/**
 * Parse return values from a FinTS 4.1 XML response.
 */
function parseReturnValues(xml: unknown): FinTS4ReturnValue[] {
    const returnValues = ensureArray(getXmlValue(xml, "ReturnValue") as Record<string, unknown>[]);
    return returnValues.map((rv) => ({
        code: getXmlString(rv, "Code") || "",
        message: getXmlString(rv, "Message") || "",
        isError: isErrorCode(getXmlString(rv, "Code") || ""),
        parameters: ensureArray(getXmlValue(rv, "Parameter") as string[]),
    }));
}

/**
 * Determine if a FinTS return code indicates an error.
 * Codes starting with "9" are errors, "3" are warnings, "0" are informational.
 */
export function isErrorCode(code: string): boolean {
    return code.startsWith("9");
}

/**
 * Parse TAN methods from a FinTS 4.1 XML response.
 */
function parseTanMethods(xml: unknown): TanMethod[] {
    const tanMethods = ensureArray(getXmlValue(xml, "TANMethod") as Record<string, unknown>[]);
    return tanMethods.map((tm) => ({
        securityFunction: getXmlString(tm, "SecurityFunction") || "",
        tanProcess: getXmlString(tm, "TANProcess") || "1",
        techId: getXmlString(tm, "TechID") || "",
        name: getXmlString(tm, "Name") || "",
        maxLengthInput: getXmlNumber(tm, "MaxLengthInput") || 6,
        allowedFormat: getXmlString(tm, "AllowedFormat") || "0",
        tanListNumberRequired: getXmlString(tm, "TANListNumberRequired") === "true",
        cancellable: getXmlString(tm, "Cancellable") === "true",
        decoupledMaxStatusRequests: getXmlNumber(tm, "DecoupledMaxStatusRequests"),
        decoupledWaitBeforeFirstStatusRequest: getXmlNumber(tm, "DecoupledWaitBeforeFirstStatusRequest"),
        decoupledWaitBetweenStatusRequests: getXmlNumber(tm, "DecoupledWaitBetweenStatusRequests"),
    }));
}

/**
 * Parse SEPA accounts from a FinTS 4.1 XML response.
 */
function parseAccounts(xml: unknown): SEPAAccount[] {
    const accounts = ensureArray(getXmlValue(xml, "Account") as Record<string, unknown>[]);
    return accounts.map((acct) => ({
        iban: getXmlString(acct, "IBAN") || "",
        bic: getXmlString(acct, "BIC") || "",
        accountNumber: getXmlString(acct, "AccountNumber") || "",
        subAccount: getXmlString(acct, "SubAccount"),
        blz: getXmlString(acct, "BLZ") || "",
        accountOwnerName: getXmlString(acct, "OwnerName"),
        accountName: getXmlString(acct, "AccountName"),
    }));
}

/**
 * Parse Bank Parameter Data from a FinTS 4.1 XML response.
 *
 * Handles multiple structures used by different banks:
 * - Nested `<BPD>` element inside a segment body
 * - Flat element names with varying capitalisation
 */
function parseBPD(xml: unknown): BankParameterData | undefined {
    const bpd = getXmlValue(xml, "BPD") as Record<string, unknown> | undefined;
    if (!bpd) return undefined;

    const segmentVersions = new Map<string, number>();
    const segments = ensureArray(getXmlValue(bpd, "Segment") as Record<string, unknown>[]);
    for (const seg of segments) {
        const type = getXmlString(seg, "Type");
        const version = getXmlNumber(seg, "Version");
        if (type && version != null) {
            const existing = segmentVersions.get(type) || 0;
            if (version > existing) {
                segmentVersions.set(type, version);
            }
        }
    }

    // maxTransactionsPerMsg — banks use various element names
    const maxTx =
        getXmlNumber(bpd, "MaxTransactions") ??
        getXmlNumber(bpd, "MaxTransactionsPerMsg") ??
        getXmlNumber(bpd, "MaxBusinessTransactions") ??
        getXmlNumber(bpd, "maxTransactions");

    // Minimum signatures — may appear under dedicated sub-elements
    const balanceParams = getXmlValue(bpd, "BalanceParams") as Record<string, unknown> | undefined;
    const stmtParams = getXmlValue(bpd, "StatementParams") as Record<string, unknown> | undefined;

    const minSigBalance =
        getXmlNumber(bpd, "MinSignaturesBalance") ??
        (balanceParams ? getXmlNumber(balanceParams, "MinSignatures") : undefined);
    const minSigStatement =
        getXmlNumber(bpd, "MinSignaturesStatement") ??
        (stmtParams ? getXmlNumber(stmtParams, "MinSignatures") : undefined);

    return {
        bankName: getXmlString(bpd, "BankName"),
        bpdVersion: getXmlNumber(bpd, "BPDVersion") ?? getXmlNumber(bpd, "BpdVersion"),
        supportedVersions: ensureArray(getXmlValue(bpd, "Version") as string[]).map(String),
        maxTransactionsPerMsg: maxTx,
        supportedLanguages: ensureArray(getXmlValue(bpd, "Language") as string[]).map(String),
        supportedSecurityMethods: ensureArray(getXmlValue(bpd, "SecurityMethod") as string[]).map(String),
        segmentVersions,
        painFormats: ensureArray(getXmlValue(bpd, "PainFormat") as string[]).map(String),
        camtFormats: ensureArray(getXmlValue(bpd, "CamtFormat") as string[]).map(String),
        minSignaturesBalance: minSigBalance,
        minSignaturesStatement: minSigStatement,
    };
}

/**
 * Parse User Parameter Data from a FinTS 4.1 XML response.
 */
function parseUPD(xml: unknown): UserParameterData | undefined {
    const upd = getXmlValue(xml, "UPD") as Record<string, unknown> | undefined;
    if (!upd) return undefined;

    const accounts = ensureArray(getXmlValue(upd, "Account") as Record<string, unknown>[]);
    const userAccounts: UserAccount[] = accounts.map((acct) => ({
        iban: getXmlString(acct, "IBAN") || "",
        bic: getXmlString(acct, "BIC"),
        accountNumber: getXmlString(acct, "AccountNumber"),
        blz: getXmlString(acct, "BLZ"),
        ownerName: getXmlString(acct, "OwnerName"),
        accountName: getXmlString(acct, "AccountName"),
        allowedTransactions: ensureArray(getXmlValue(acct, "Transaction") as string[]).map(String),
    }));

    return {
        updVersion: getXmlNumber(upd, "UPDVersion"),
        accounts: userAccounts,
    };
}

/**
 * Parse a segment from the response.
 */
function parseSegmentVersions(msgBody: unknown): Map<string, number> {
    const versions = new Map<string, number>();
    const segments = ensureArray(getXmlValue(msgBody, "Segment") as Record<string, unknown>[]);
    for (const seg of segments) {
        const segHead = getXmlValue(seg, "SegHead") as Record<string, unknown> | undefined;
        if (segHead) {
            const type = getXmlString(segHead, "Type");
            const version = getXmlNumber(segHead, "Version");
            if (type && version != null) {
                const existing = versions.get(type) || 0;
                if (version > existing) {
                    versions.set(type, version);
                }
            }
        }
    }
    return versions;
}

/**
 * Find a segment of a specific type in the message body.
 */
export function findSegment(msgBody: unknown, segmentType: string): Record<string, unknown> | undefined {
    const segments = ensureArray(getXmlValue(msgBody, "Segment") as Record<string, unknown>[]);
    return segments.find((seg) => {
        const segHead = getXmlValue(seg, "SegHead") as Record<string, unknown> | undefined;
        return segHead && getXmlString(segHead, "Type") === segmentType;
    });
}

/**
 * Find all segments of a specific type in the message body.
 */
export function findSegments(msgBody: unknown, segmentType: string): Record<string, unknown>[] {
    const segments = ensureArray(getXmlValue(msgBody, "Segment") as Record<string, unknown>[]);
    return segments.filter((seg) => {
        const segHead = getXmlValue(seg, "SegHead") as Record<string, unknown> | undefined;
        return segHead && getXmlString(segHead, "Type") === segmentType;
    });
}

/**
 * FinTS return code indicating a TAN is required before the order can proceed.
 * The server sends this together with a challenge that the user must respond to.
 */
const RETURN_CODE_TAN_REQUIRED = "0030";

/**
 * Parse a TAN challenge from a response segment.
 * Returns undefined if the segment body does not contain the expected challenge fields.
 */
function parseTanChallenge(segBody: unknown, tanMethods?: Array<{ name?: string }>): TanChallenge | undefined {
    const body = segBody as Record<string, unknown> | undefined;
    if (!body) return undefined;

    const transactionReference =
        getXmlString(body, "TransactionReference") ||
        getXmlString(body, "ARef") ||
        getXmlString(body, "OrderReference");

    if (!transactionReference) return undefined;

    return {
        transactionReference,
        challengeText:
            getXmlString(body, "ChallengeText") || getXmlString(body, "Challenge") || getXmlString(body, "OrderInfo"),
        challengeHhd: getXmlString(body, "ChallengeHHD") || getXmlString(body, "ChallengeHHDUC"),
        tanMethodName: getXmlString(body, "TANMedium") || tanMethods?.[0]?.name,
        challengeValidSeconds: getXmlNumber(body, "ChallengeValidSeconds"),
    };
}

/**
 * Parse a complete FinTS 4.1 XML response string.
 */
export function parseResponse(xmlString: string): FinTS4Response {
    const parser = createParser();
    const parsed = parser.parse(xmlString);

    const fintsMsg = parsed.FinTSMessage || parsed;
    const msgHead = fintsMsg.MsgHead || {};
    const msgBody = fintsMsg.MsgBody || {};

    const dialogId = getXmlString(msgHead, "DialogID") || "0";
    const msgNo = getXmlNumber(msgHead, "MsgNo") || 0;

    // Parse return values from all sources
    const returnValues = [...parseReturnValues(msgBody), ...parseReturnValues(fintsMsg)];

    const success = !returnValues.some((rv) => rv.isError);

    // Detect TAN requirement (code 0030)
    const tanRequired = returnValues.some((rv) => rv.code === RETURN_CODE_TAN_REQUIRED);

    // Parse system ID from sync response
    const syncSegment = findSegment(msgBody, "SyncRes");
    const systemId = syncSegment
        ? getXmlString(getXmlValue(syncSegment, "SegBody") as Record<string, unknown>, "SystemID")
        : undefined;

    // Parse BPD
    const bpdSegment = findSegment(msgBody, "BPD");
    const bpd = bpdSegment ? parseBPD(getXmlValue(bpdSegment, "SegBody")) : undefined;

    // Parse UPD
    const updSegment = findSegment(msgBody, "UPD");
    const upd = updSegment ? parseUPD(getXmlValue(updSegment, "SegBody")) : undefined;

    // Parse TAN methods
    const tanMethodsSegment = findSegment(msgBody, "TANMethods");
    const tanMethodsList = tanMethodsSegment ? parseTanMethods(getXmlValue(tanMethodsSegment, "SegBody")) : undefined;

    // Parse accounts
    const accountsSegment = findSegment(msgBody, "AccountList");
    const accounts = accountsSegment ? parseAccounts(getXmlValue(accountsSegment, "SegBody")) : undefined;

    // Parse camt data
    const statementSegment = findSegment(msgBody, "AccountStatement");
    const camtData = statementSegment
        ? getXmlString(getXmlValue(statementSegment, "SegBody") as Record<string, unknown>, "CamtData")
        : undefined;

    // Parse segment versions from the response
    const segmentVersions = parseSegmentVersions(msgBody);

    // Parse BPD segment versions into the response
    if (bpd?.segmentVersions) {
        for (const [type, version] of bpd.segmentVersions) {
            segmentVersions.set(type, version);
        }
    }

    // Parse supported HBCI versions
    const supportedHbciVersions = bpd?.supportedVersions;

    // Parse pain formats
    const painFormats = bpd?.painFormats;

    // Parse camt formats
    const supportedCamtFormats = bpd?.camtFormats;

    // Parse touchdown from return values
    const touchdownRv = returnValues.find((rv) => rv.code === "3040");
    const touchdown = touchdownRv?.parameters?.[0];

    // Parse TAN challenge from dedicated segment or from 0030 return-value parameters
    let tanChallenge: TanChallenge | undefined;
    if (tanRequired) {
        const challengeSegment = findSegment(msgBody, "TanChallenge") || findSegment(msgBody, "TANChallenge");
        if (challengeSegment) {
            tanChallenge = parseTanChallenge(getXmlValue(challengeSegment, "SegBody"), tanMethodsList);
        }
        // Fall back to extracting from the 0030 return value parameters
        if (!tanChallenge) {
            const tanRv = returnValues.find((rv) => rv.code === RETURN_CODE_TAN_REQUIRED);
            const ref = tanRv?.parameters?.[0];
            if (ref) {
                tanChallenge = {
                    transactionReference: ref,
                    challengeText: tanRv?.parameters?.[1] || tanRv?.message,
                };
            }
        }
    }

    return {
        dialogId,
        msgNo,
        success,
        returnValues,
        systemId,
        bpd,
        upd,
        tanMethods: tanMethodsList,
        accounts,
        camtData,
        supportedHbciVersions,
        segmentVersions,
        painFormats,
        supportedCamtFormats,
        touchdown,
        rawXml: fintsMsg,
        tanRequired,
        tanChallenge,
    };
}

/**
 * Quick check if an XML response string appears to be a FinTS 4.1 XML message.
 */
export function isFinTS4Response(data: string): boolean {
    return data.trimStart().startsWith("<?xml") || data.trimStart().startsWith("<FinTSMessage");
}
