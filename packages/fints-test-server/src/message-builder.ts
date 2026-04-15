/**
 * FinTS response message builder.
 *
 * Constructs well-formed FinTS 3.0 response messages with proper
 * message headers, encryption envelopes, and segment numbering.
 *
 * Reference: FinTS 3.0 specification sections B.5 (message structure)
 */
import {
    formatDate,
    formatTime,
    formatNum,
    formatDig,
    formatStringWithLength,
    escapeFinTS,
} from "./protocol";

const HBCI_VERSION = 300;
const COUNTRY_CODE = 280;

/**
 * Build a single segment string.
 * Format: TYPE:segNo:version[:reference]+dg1+dg2+...+dgN'
 */
export function buildSegment(
    type: string,
    segNo: number,
    version: number,
    dataGroups: (string | string[])[],
    reference?: number,
): string {
    const header = reference !== undefined
        ? `${type}:${segNo}:${version}:${reference}`
        : `${type}:${segNo}:${version}`;
    const body = dataGroups
        .map((dg) => (Array.isArray(dg) ? dg.join(":") : dg))
        .join("+");
    return `${header}+${body}'`;
}

/**
 * Wrap inner segments in the FinTS message envelope (HNHBK + HNVSK + HNVSD + HNHBS).
 *
 * Structure per FinTS 3.0 spec:
 * - HNHBK: Message header with total length, dialog ID, message number
 * - HNVSK: Encryption header (PIN profile)
 * - HNVSD: Encrypted data container wrapping all inner segments (HNSHK + payload + HNSHA)
 * - HNHBS: Message footer
 */
export function buildMessage(options: {
    dialogId: string;
    msgNo: number;
    blz: string;
    userName: string;
    systemId: string;
    profileVersion: number;
    innerSegments: string[];
    secRef?: number;
}): string {
    const {
        dialogId,
        msgNo,
        blz,
        userName,
        systemId,
        profileVersion,
        innerSegments,
        secRef = 2,
    } = options;

    const now = new Date();
    const dateStr = formatDate(now);
    const timeStr = formatTime(now);

    // HNSHK: Signature header (segNo=2 inside HNVSD)
    const hnshk = buildSegment("HNSHK", 2, 4, [
        ["PIN", formatNum(profileVersion)],
        "999",
        formatNum(secRef),
        formatNum(1),
        formatNum(1),
        ["2", "", systemId],
        "0",
        ["1", dateStr, timeStr],
        ["1", "999", "1"],
        ["6", "10", "16"],
        [formatNum(COUNTRY_CODE), blz, escapeFinTS(userName), "S", formatNum(0), formatNum(0)],
    ]);

    // Count total inner segments (HNSHK + payload + HNSHA)
    const totalInnerCount = 2 + innerSegments.length; // HNSHK + payload segments + HNSHA
    const segCount = totalInnerCount + 1; // +1 because HNSHA segNo = 2 + innerSegments.length

    // HNSHA: Signature footer
    const hnsha = buildSegment("HNSHA", 2 + innerSegments.length + 1, 2, [
        formatNum(secRef),
    ]);

    // All content inside HNVSD
    const innerContent = hnshk + innerSegments.join("") + hnsha;

    // HNVSD: Encrypted data container
    const hnvsd = buildSegment("HNVSD", 999, 1, [
        formatStringWithLength(innerContent),
    ]);

    // HNVSK: Encryption header
    const hnvsk = buildSegment("HNVSK", 998, 3, [
        ["PIN", formatNum(profileVersion)],
        formatNum(998),
        formatNum(1),
        ["1", "", systemId],
        ["1", dateStr, timeStr],
        ["2", "2", "13", formatStringWithLength("00000000"), "5", "1"],
        [formatNum(COUNTRY_CODE), blz, escapeFinTS(userName), "V", formatNum(0), formatNum(0)],
        formatNum(0),
    ]);

    // HNHBS: Message footer
    const hnhbs = buildSegment("HNHBS", segCount + 2, 1, [
        formatNum(msgNo),
    ]);

    // Calculate total message length for HNHBK
    const bodyWithoutHeader = hnvsk + hnvsd + hnhbs;
    // HNHBK header: "HNHBK:1:3+" + dig(length) + "+300+" + dialogId + "+" + msgNo + "+" + dialogId + ":" + msgNo + "'"
    // We need to compute the total length including the HNHBK itself
    const hnhbkPrefix = `HNHBK:1:3+`;
    const hnhbkBody = `+${formatNum(HBCI_VERSION)}+${dialogId}+${formatNum(msgNo)}+${dialogId}:${formatNum(msgNo)}'`;
    const totalLength = hnhbkPrefix.length + 12 + hnhbkBody.length + bodyWithoutHeader.length;

    const hnhbk = `${hnhbkPrefix}${formatDig(totalLength)}${hnhbkBody}`;

    return hnhbk + bodyWithoutHeader;
}

/**
 * Build HIRMG (message-level return codes) segment.
 */
export function buildHIRMG(
    segNo: number,
    returnCodes: Array<{ code: string; message: string; reference?: number }>,
    reference?: number,
): string {
    const dataGroups = returnCodes.map((rc) => [rc.code, "", rc.message]);
    return buildSegment("HIRMG", segNo, 2, dataGroups, reference);
}

/**
 * Build HIRMS (segment-level return codes) segment.
 */
export function buildHIRMS(
    segNo: number,
    returnCodes: Array<{ code: string; message: string; parameters?: string[] }>,
    reference?: number,
): string {
    const dataGroups = returnCodes.map((rc) => {
        const params = rc.parameters || [];
        return [rc.code, "", rc.message, ...params];
    });
    return buildSegment("HIRMS", segNo, 2, dataGroups, reference);
}

/**
 * Build HIBPA (bank parameters) segment.
 */
export function buildHIBPA(
    segNo: number,
    options: {
        bpdVersion: number;
        blz: string;
        bankName: string;
    },
    reference?: number,
): string {
    return buildSegment("HIBPA", segNo, 3, [
        formatNum(options.bpdVersion),
        [formatNum(COUNTRY_CODE), options.blz],
        escapeFinTS(options.bankName),
        formatNum(1),
        formatNum(1),
        formatNum(HBCI_VERSION),
        formatNum(500),
    ], reference);
}

/**
 * Build HISYN (synchronization response) segment.
 */
export function buildHISYN(segNo: number, systemId: string, reference?: number): string {
    return buildSegment("HISYN", segNo, 4, [systemId], reference);
}

/**
 * Build HISPAS (supported SEPA pain formats) segment.
 */
export function buildHISPAS(segNo: number, painFormats: string[], reference?: number): string {
    return buildSegment("HISPAS", segNo, 1, [
        formatNum(1),
        formatNum(1),
        formatNum(1),
        ["J", "J", "N", ...painFormats],
    ], reference);
}

/**
 * Build HITANS (TAN methods) segment.
 *
 * Version 6 format per FinTS PINTAN specification.
 */
export function buildHITANS(
    segNo: number,
    options: {
        version?: number;
        securityFunctions: string[];
        tanMethods: Array<{
            securityFunction: string;
            tanProcess: string;
            techId: string;
            zkaId?: string;
            zkaVersion?: string;
            name: string;
            maxLengthInput: number;
            allowedFormat: number;
            textReturnvalue: string;
            maxLengthReturnvalue: number;
            multipleAllowed: boolean;
            tanTimeDialogAssociation: string;
            cancellable: boolean;
            smsChargeAccountRequired: string;
            principalAccountRequired: string;
            challengeClassRequired: boolean;
            challengeStructured: boolean;
            initializationMode: string;
            descriptionRequired: string;
            hhdUcRequired: boolean;
            supportedMediaNumber: number;
        }>;
    },
    reference?: number,
): string {
    const version = options.version || 6;
    const tanMethodParts: string[] = [];

    for (const tm of options.tanMethods) {
        if (version >= 4 && version <= 5) {
            tanMethodParts.push(
                tm.securityFunction,
                tm.tanProcess,
                tm.techId,
                tm.zkaId || "",
                tm.zkaVersion || "",
                tm.name,
                formatNum(tm.maxLengthInput),
                formatNum(tm.allowedFormat),
                tm.textReturnvalue,
                formatNum(tm.maxLengthReturnvalue),
                version === 5 ? formatNum(1) : formatNum(1),
                tm.multipleAllowed ? "J" : "N",
                tm.tanTimeDialogAssociation,
                tm.cancellable ? "J" : "N",
                tm.smsChargeAccountRequired,
                ...(version === 5 ? [tm.principalAccountRequired] : []),
                tm.challengeClassRequired ? "J" : "N",
                ...(version === 4 ? [tm.challengeStructured ? "J" : "N"] : []),
                tm.challengeStructured ? "J" : "N",
                tm.initializationMode,
                tm.descriptionRequired,
                formatNum(tm.supportedMediaNumber),
            );
        } else if (version === 6) {
            tanMethodParts.push(
                tm.securityFunction,
                tm.tanProcess,
                tm.techId,
                tm.zkaId || "",
                tm.zkaVersion || "",
                tm.name,
                formatNum(tm.maxLengthInput),
                formatNum(tm.allowedFormat),
                tm.textReturnvalue,
                formatNum(tm.maxLengthReturnvalue),
                tm.multipleAllowed ? "J" : "N",
                tm.tanTimeDialogAssociation,
                tm.cancellable ? "J" : "N",
                tm.smsChargeAccountRequired,
                tm.principalAccountRequired,
                tm.challengeClassRequired ? "J" : "N",
                tm.challengeStructured ? "J" : "N",
                tm.initializationMode,
                tm.descriptionRequired,
                tm.hhdUcRequired ? "J" : "N",
                formatNum(tm.supportedMediaNumber),
            );
        }
    }

    return buildSegment("HITANS", segNo, version, [
        formatNum(1),
        formatNum(1),
        formatNum(1),
        ["J", "N", "0", ...tanMethodParts],
    ], reference);
}

/**
 * Build HIKAZS (statement parameters) segment.
 */
export function buildHIKAZS(segNo: number, version: number, reference?: number): string {
    if (version <= 5) {
        return buildSegment("HIKAZS", segNo, version, [
            formatNum(1),
            formatNum(1),
            ["365", "J", "N"],
        ], reference);
    }
    return buildSegment("HIKAZS", segNo, version, [
        formatNum(1),
        formatNum(1),
        formatNum(1),
        ["365", "J", "N"],
    ], reference);
}

/**
 * Build HISALS (balance parameters) segment.
 */
export function buildHISALS(segNo: number, version: number, reference?: number): string {
    if (version <= 6) {
        return buildSegment("HISALS", segNo, version, [
            formatNum(3),
            formatNum(1),
        ], reference);
    }
    return buildSegment("HISALS", segNo, version, [
        formatNum(1),
        formatNum(1),
        formatNum(1),
    ], reference);
}

/**
 * Build HICDBS (standing orders parameters) segment.
 */
export function buildHICDBS(segNo: number, reference?: number): string {
    return buildSegment("HICDBS", segNo, 1, [
        formatNum(1),
        formatNum(1),
        formatNum(1),
        ["N"],
    ], reference);
}

/**
 * Build HICCSS (credit transfer parameters) segment.
 */
export function buildHICCSS(segNo: number, reference?: number): string {
    return buildSegment("HICCSS", segNo, 1, [
        formatNum(1),
        formatNum(1),
        formatNum(1),
    ], reference);
}

/**
 * Build HIDSES (direct debit parameters) segment.
 */
export function buildHIDSES(segNo: number, reference?: number): string {
    return buildSegment("HIDSES", segNo, 1, [
        formatNum(1),
        formatNum(1),
        formatNum(1),
        ["3", "45", "6", "45"],
    ], reference);
}

/**
 * Build HIWPDS (holdings parameters) segment.
 */
export function buildHIWPDS(segNo: number, reference?: number): string {
    return buildSegment("HIWPDS", segNo, 1, [
        formatNum(1),
        formatNum(1),
    ], reference);
}

/**
 * Build HIUPD (account update info) segment.
 */
export function buildHIUPD(
    segNo: number,
    options: {
        accountNumber: string;
        blz: string;
        iban: string;
        userName: string;
        currency: string;
        ownerName: string;
        accountName: string;
        limitValue?: string;
        supportedOps?: string[];
    },
    reference?: number,
): string {
    const ops = options.supportedOps || [
        "HKSAL:1", "HKKAZ:1", "HKCDB:1", "HKSPA:1",
        "HKCCS:1", "HKDSE:1", "HKPRO:1",
    ];
    return buildSegment("HIUPD", segNo, 6, [
        [options.accountNumber, "", formatNum(COUNTRY_CODE), options.blz],
        options.iban,
        options.userName,
        "",
        options.currency,
        options.ownerName,
        "",
        options.accountName,
        ["", options.limitValue || ""],
        ...ops,
    ], reference);
}

/**
 * Build HISPA (SEPA accounts) segment.
 */
export function buildHISPA(
    segNo: number,
    accounts: Array<{
        iban: string;
        bic: string;
        accountNumber: string;
        subAccount: string;
        blz: string;
    }>,
    reference?: number,
): string {
    const dataGroups = accounts.map((a) => [
        "J",
        a.iban,
        a.bic,
        a.accountNumber,
        a.subAccount,
        formatNum(COUNTRY_CODE),
        a.blz,
    ]);
    return buildSegment("HISPA", segNo, 1, dataGroups, reference);
}

/**
 * Build HISAL (balance response) segment.
 */
export function buildHISAL(
    segNo: number,
    options: {
        accountNumber: string;
        subAccount: string;
        blz: string;
        productName: string;
        currency: string;
        bookedBalance: number;
        pendingBalance: number;
        creditLimit: number;
        availableBalance: number;
    },
    reference?: number,
): string {
    return buildSegment("HISAL", segNo, 7, [
        [options.accountNumber, options.subAccount, formatNum(COUNTRY_CODE), options.blz],
        options.productName,
        options.currency,
        ["C", formatNum(options.bookedBalance)],
        ["C", formatNum(options.pendingBalance)],
        formatNum(options.creditLimit),
        formatNum(options.availableBalance),
    ], reference);
}

/**
 * Build HIKAZ (statement response) segment.
 * The MT940 data is passed as a raw string.
 */
export function buildHIKAZ(
    segNo: number,
    mt940Data: string,
    reference?: number,
): string {
    return buildSegment("HIKAZ", segNo, 7, [
        formatStringWithLength(mt940Data),
    ], reference);
}

/**
 * Build HITAN (TAN challenge) segment for version 6.
 */
export function buildHITAN(
    segNo: number,
    options: {
        process: string;
        transactionHash?: string;
        transactionReference: string;
        challengeText: string;
    },
    reference?: number,
): string {
    return buildSegment("HITAN", segNo, 6, [
        options.process,
        options.transactionHash || "",
        options.transactionReference,
        options.challengeText,
    ], reference);
}

/**
 * Build HIPINS (PIN/TAN info) segment.
 */
export function buildHIPINS(segNo: number, reference?: number): string {
    return buildSegment("HIPINS", segNo, 1, [
        formatNum(1),
        formatNum(1),
        formatNum(1),
        ["5", "20", "6", "Benutzer ID", "",
            "HKSPA:N", "HKKAZ:N", "HKSAL:N", "HKCCS:J", "HKDSE:J",
            "HKCDB:N", "HKTAN:N"],
    ], reference);
}
