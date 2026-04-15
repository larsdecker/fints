/**
 * FinTS request handler.
 *
 * Processes incoming FinTS requests according to FinTS 3.0 specification
 * and generates appropriate responses. Implements dialog management,
 * authentication, and all supported banking operations.
 *
 * Reference: FinTS 3.0 specification (Formals / Geschäftsvorfälle)
 */
import {
    ParsedSegment,
    parse,
    parseSegment,
    extractInnerSegments,
    formatNum,
} from "./protocol";
import {
    buildMessage,
    buildHIRMG,
    buildHIRMS,
    buildHIBPA,
    buildHISYN,
    buildHISPAS,
    buildHITANS,
    buildHIKAZS,
    buildHISALS,
    buildHICDBS,
    buildHICCSS,
    buildHIDSES,
    buildHIWPDS,
    buildHIUPD,
    buildHISPA,
    buildHISAL,
    buildHIKAZ,
    buildHITAN,
    buildHIPINS,
} from "./message-builder";
import {
    FinTSTestConfig,
    generateMT940,
} from "./test-data";

/**
 * Active dialog session state.
 */
interface DialogSession {
    dialogId: string;
    userName: string;
    systemId: string;
    msgNo: number;
    authenticated: boolean;
}

/**
 * Counter for generating unique dialog IDs.
 */
let dialogCounter = 10000000;

/**
 * Generate a unique system ID.
 */
function generateSystemId(): string {
    return `DDDA${String(Date.now()).padStart(25, "0").slice(0, 25)}A`;
}

/**
 * The FinTS request handler manages dialog sessions and processes
 * all incoming FinTS protocol messages.
 */
export class FinTSRequestHandler {
    private sessions: Map<string, DialogSession> = new Map();
    private config: FinTSTestConfig;

    constructor(config: FinTSTestConfig) {
        this.config = config;
    }

    /**
     * Process a raw FinTS message string and return a response string.
     */
    public processMessage(messageStr: string): string {
        const segments = parse(messageStr);
        const parsedSegments = segments.map(parseSegment);
        const innerSegments = extractInnerSegments(parsedSegments);

        // Extract message metadata from HNHBK
        const hnhbk = parsedSegments.find((s) => s.type === "HNHBK");
        const dialogId = hnhbk?.dataGroups[2]?.[0] || "0";
        const msgNo = Number(hnhbk?.dataGroups[3]?.[0] || "1");

        // Extract user info from HNVSK
        const hnvsk = parsedSegments.find((s) => s.type === "HNVSK");
        const userName = hnvsk?.dataGroups[6]?.[2] || "";
        const profileVersion = Number(hnvsk?.dataGroups[0]?.[1] || "1");

        // Extract authentication from HNSHA (inside HNVSD)
        const hnsha = innerSegments.find((s) => s.type === "HNSHA");
        const pin = hnsha?.dataGroups[2]?.[0] || "";

        // Detect request types
        const hksyn = innerSegments.find((s) => s.type === "HKSYN");
        const hkidn = innerSegments.find((s) => s.type === "HKIDN");
        const hkvvb = innerSegments.find((s) => s.type === "HKVVB");
        const hkend = innerSegments.find((s) => s.type === "HKEND");
        const hkspa = innerSegments.find((s) => s.type === "HKSPA");
        const hksal = innerSegments.find((s) => s.type === "HKSAL");
        const hkkaz = innerSegments.find((s) => s.type === "HKKAZ");
        const hkcdb = innerSegments.find((s) => s.type === "HKCDB");
        const hkccs = innerSegments.find((s) => s.type === "HKCCS");
        const hkdse = innerSegments.find((s) => s.type === "HKDSE");
        const hktan = innerSegments.find((s) => s.type === "HKTAN");

        // Authenticate user
        const isValidUser = this.authenticateUser(
            hkidn?.dataGroups[1]?.[0] || userName,
            pin,
        );

        // Process synchronization request (HKSYN)
        if (hksyn) {
            return this.handleSync(userName, profileVersion, msgNo, isValidUser);
        }

        // Process dialog end (HKEND)
        if (hkend) {
            return this.handleEnd(dialogId, userName, profileVersion, msgNo);
        }

        // Dialog initialization (HKIDN + HKVVB without HKSYN)
        if (hkidn && hkvvb && !hksyn) {
            return this.handleInit(userName, profileVersion, msgNo, isValidUser, hktan, innerSegments);
        }

        // Look up the session
        const session = this.sessions.get(dialogId);
        if (!session) {
            return this.buildErrorMessage(dialogId, userName, "0", profileVersion, msgNo,
                "9800", "Dialoginitialisierung erforderlich");
        }
        session.msgNo = msgNo;

        // Process SEPA accounts request (HKSPA)
        if (hkspa) {
            return this.handleSPA(session, userName, profileVersion, msgNo, hkspa, hktan);
        }

        // Process balance request (HKSAL)
        if (hksal) {
            return this.handleSAL(session, userName, profileVersion, msgNo, hksal, hktan);
        }

        // Process statement request (HKKAZ)
        if (hkkaz) {
            return this.handleKAZ(session, userName, profileVersion, msgNo, hkkaz, hktan);
        }

        // Process standing orders request (HKCDB)
        if (hkcdb) {
            return this.handleCDB(session, userName, profileVersion, msgNo, hkcdb, hktan);
        }

        // Process credit transfer (HKCCS)
        if (hkccs) {
            return this.handleCCS(session, userName, profileVersion, msgNo, hkccs, hktan);
        }

        // Process direct debit (HKDSE)
        if (hkdse) {
            return this.handleDSE(session, userName, profileVersion, msgNo, hkdse, hktan);
        }

        // Process standalone TAN submission (HKTAN)
        if (hktan) {
            return this.handleTAN(session, userName, profileVersion, msgNo, hktan);
        }

        // Unknown request
        return this.buildErrorMessage(dialogId, userName, "0", profileVersion, msgNo,
            "9999", "Unbekannter Geschaeftsvorfall");
    }

    /**
     * Validate user credentials.
     */
    private authenticateUser(name: string, pin: string): boolean {
        // During sync, pin might be empty or "xxxxx" - allow it
        if (!pin || pin === "xxxxx") return true;
        return this.config.users.some((u) => u.name === name && u.pin === pin);
    }

    /**
     * Handle HKSYN (Synchronisation) request.
     *
     * Response contains: HIRMG, HIRMS, HIBPA, HISPAS, HITANS, HIKAZS,
     * HISALS, HICDBS, HICCSS, HIDSES, HIPINS, HIUPD, HISYN
     *
     * Reference: FinTS 3.0 specification section C.8.2
     */
    private handleSync(
        userName: string,
        profileVersion: number,
        msgNo: number,
        isValidUser: boolean,
    ): string {
        const newDialogId = `DIA_${++dialogCounter}`;
        const systemId = generateSystemId();
        const { blz, bankName, bpdVersion, painFormats, accounts } = this.config;

        // Create session
        this.sessions.set(newDialogId, {
            dialogId: newDialogId,
            userName,
            systemId,
            msgNo,
            authenticated: isValidUser,
        });

        const innerSegs: string[] = [];
        let segNo = 3;

        // HIRMG: General return codes
        innerSegs.push(buildHIRMG(segNo++, [
            { code: "3060", message: "Bitte beachten Sie die enthaltenen Warnungen/Hinweise" },
        ]));

        // HIRMS for HKIDN (ref=3): BPD/UPD info + TAN methods + PIN valid + dialog init
        innerSegs.push(buildHIRMS(segNo++, [
            { code: "3050", message: "BPD nicht mehr aktuell, aktuelle Version enthalten." },
            { code: "3050", message: "UPD nicht mehr aktuell, aktuelle Version enthalten." },
            { code: "3920", message: "Zugelassene TAN-Verfahren fur den Benutzer", parameters: ["942"] },
            ...(isValidUser
                ? [{ code: "0901", message: "*PIN gultig." }]
                : [{ code: "9931", message: "PIN ungueltig." }]),
            { code: "0020", message: "*Dialoginitialisierung erfolgreich" },
        ], 4));

        // HIRMS for HKSYN (ref=5)
        innerSegs.push(buildHIRMS(segNo++, [
            { code: "0020", message: "Auftrag ausgefuhrt." },
        ], 5));

        // HIBPA: Bank parameters
        innerSegs.push(buildHIBPA(segNo++, { bpdVersion, blz, bankName }, 4));

        // HIKAZS: Statement parameters (multiple versions as real banks do)
        innerSegs.push(buildHIKAZS(segNo++, 5, 4));
        innerSegs.push(buildHIKAZS(segNo++, 6, 4));
        innerSegs.push(buildHIKAZS(segNo++, 7, 4));

        // HISALS: Balance parameters
        innerSegs.push(buildHISALS(segNo++, 5, 4));
        innerSegs.push(buildHISALS(segNo++, 7, 4));

        // HICDBS: Standing orders parameters
        innerSegs.push(buildHICDBS(segNo++, 4));

        // HICCSS: Credit transfer parameters
        innerSegs.push(buildHICCSS(segNo++, 4));

        // HIDSES: Direct debit parameters
        innerSegs.push(buildHIDSES(segNo++, 4));

        // HIWPDS: Holdings parameters
        innerSegs.push(buildHIWPDS(segNo++, 4));

        // HISPAS: SEPA pain formats
        innerSegs.push(buildHISPAS(segNo++, painFormats, 4));

        // HITANS: TAN methods (version 6)
        innerSegs.push(buildHITANS(segNo++, {
            version: 6,
            securityFunctions: ["942"],
            tanMethods: [{
                securityFunction: "942",
                tanProcess: "2",
                techId: "MTAN2",
                zkaId: "mobileTAN",
                zkaVersion: "",
                name: "mobile TAN",
                maxLengthInput: 6,
                allowedFormat: 1,
                textReturnvalue: "SMS",
                maxLengthReturnvalue: 2048,
                multipleAllowed: false,
                tanTimeDialogAssociation: "N",
                cancellable: true,
                smsChargeAccountRequired: "0",
                principalAccountRequired: "N",
                challengeClassRequired: false,
                challengeStructured: false,
                initializationMode: "00",
                descriptionRequired: "1",
                hhdUcRequired: false,
                supportedMediaNumber: 1,
            }],
        }, 4));

        // HIPINS: PIN/TAN info
        innerSegs.push(buildHIPINS(segNo++, 4));

        // HIUPD: Account info for each account
        for (const account of accounts) {
            innerSegs.push(buildHIUPD(segNo++, {
                accountNumber: account.accountNumber,
                blz: account.blz,
                iban: account.iban,
                userName,
                currency: account.currency,
                ownerName: account.ownerName,
                accountName: account.accountName,
            }, 4));
        }

        // HISYN: System ID
        innerSegs.push(buildHISYN(segNo++, systemId, 5));

        return buildMessage({
            dialogId: newDialogId,
            msgNo,
            blz,
            userName,
            systemId,
            profileVersion,
            innerSegments: innerSegs,
        });
    }

    /**
     * Handle dialog end (HKEND).
     *
     * Reference: FinTS 3.0 specification section B.6.2
     */
    private handleEnd(
        dialogId: string,
        userName: string,
        profileVersion: number,
        msgNo: number,
    ): string {
        const session = this.sessions.get(dialogId);
        const systemId = session?.systemId || "0";

        // Remove session
        this.sessions.delete(dialogId);

        const innerSegs: string[] = [];
        innerSegs.push(buildHIRMG(3, [
            { code: "0010", message: "Nachricht entgegengenommen." },
            { code: "0100", message: "Dialog beendet." },
        ]));

        return buildMessage({
            dialogId,
            msgNo,
            blz: this.config.blz,
            userName,
            systemId,
            profileVersion,
            innerSegments: innerSegs,
        });
    }

    /**
     * Handle dialog initialization (HKIDN + HKVVB).
     *
     * Reference: FinTS 3.0 specification section B.6.1
     */
    private handleInit(
        userName: string,
        profileVersion: number,
        msgNo: number,
        isValidUser: boolean,
        hktan: ParsedSegment | undefined,
        innerSegments: ParsedSegment[],
    ): string {
        if (!isValidUser) {
            return this.buildErrorMessage("0", userName, "0", profileVersion, msgNo,
                "9931", "PIN ungueltig.");
        }

        const newDialogId = `DIA_${++dialogCounter}`;
        const { blz, bankName, bpdVersion, painFormats, accounts } = this.config;

        // Find the systemId from a previous sync or use default
        const systemId = "0";

        this.sessions.set(newDialogId, {
            dialogId: newDialogId,
            userName,
            systemId,
            msgNo,
            authenticated: true,
        });

        const innerSegs: string[] = [];
        let segNo = 3;

        // HIRMG
        innerSegs.push(buildHIRMG(segNo++, [
            { code: "3060", message: "Bitte beachten Sie die enthaltenen Warnungen/Hinweise" },
        ]));

        // HIRMS for HKIDN
        const hkidn = innerSegments.find((s) => s.type === "HKIDN");
        const hkidnRef = hkidn?.segNo || 3;
        innerSegs.push(buildHIRMS(segNo++, [
            { code: "3050", message: "BPD nicht mehr aktuell, aktuelle Version enthalten." },
            { code: "3050", message: "UPD nicht mehr aktuell, aktuelle Version enthalten." },
            { code: "3920", message: "Zugelassene TAN-Verfahren fur den Benutzer", parameters: ["942"] },
            { code: "0901", message: "*PIN gultig." },
            { code: "0020", message: "*Dialoginitialisierung erfolgreich" },
        ], hkidnRef));

        // HIBPA
        innerSegs.push(buildHIBPA(segNo++, { bpdVersion, blz, bankName }, hkidnRef));

        // HIKAZS, HISALS, etc. (BPD segments)
        innerSegs.push(buildHIKAZS(segNo++, 5, hkidnRef));
        innerSegs.push(buildHIKAZS(segNo++, 6, hkidnRef));
        innerSegs.push(buildHIKAZS(segNo++, 7, hkidnRef));
        innerSegs.push(buildHISALS(segNo++, 5, hkidnRef));
        innerSegs.push(buildHISALS(segNo++, 7, hkidnRef));
        innerSegs.push(buildHICDBS(segNo++, hkidnRef));
        innerSegs.push(buildHICCSS(segNo++, hkidnRef));
        innerSegs.push(buildHIDSES(segNo++, hkidnRef));
        innerSegs.push(buildHIWPDS(segNo++, hkidnRef));
        innerSegs.push(buildHISPAS(segNo++, painFormats, hkidnRef));
        innerSegs.push(buildHITANS(segNo++, {
            version: 6,
            securityFunctions: ["942"],
            tanMethods: [{
                securityFunction: "942",
                tanProcess: "2",
                techId: "MTAN2",
                zkaId: "mobileTAN",
                zkaVersion: "",
                name: "mobile TAN",
                maxLengthInput: 6,
                allowedFormat: 1,
                textReturnvalue: "SMS",
                maxLengthReturnvalue: 2048,
                multipleAllowed: false,
                tanTimeDialogAssociation: "N",
                cancellable: true,
                smsChargeAccountRequired: "0",
                principalAccountRequired: "N",
                challengeClassRequired: false,
                challengeStructured: false,
                initializationMode: "00",
                descriptionRequired: "1",
                hhdUcRequired: false,
                supportedMediaNumber: 1,
            }],
        }, hkidnRef));
        innerSegs.push(buildHIPINS(segNo++, hkidnRef));

        // HIUPD for each account
        for (const account of accounts) {
            innerSegs.push(buildHIUPD(segNo++, {
                accountNumber: account.accountNumber,
                blz: account.blz,
                iban: account.iban,
                userName,
                currency: account.currency,
                ownerName: account.ownerName,
                accountName: account.accountName,
            }, hkidnRef));
        }

        return buildMessage({
            dialogId: newDialogId,
            msgNo,
            blz,
            userName,
            systemId,
            profileVersion,
            innerSegments: innerSegs,
        });
    }

    /**
     * Handle HKSPA (SEPA account info request).
     *
     * Reference: FinTS 3.0 specification section C.10.1.3
     */
    private handleSPA(
        session: DialogSession,
        userName: string,
        profileVersion: number,
        msgNo: number,
        hkspa: ParsedSegment,
        hktan: ParsedSegment | undefined,
    ): string {
        const innerSegs: string[] = [];
        let segNo = 3;

        // HIRMG
        innerSegs.push(buildHIRMG(segNo++, [
            { code: "0010", message: "Nachricht entgegengenommen." },
        ]));

        // HIRMS for HKSPA
        innerSegs.push(buildHIRMS(segNo++, [
            { code: "0020", message: "Auftrag ausgefuehrt" },
        ], hkspa.segNo));

        // HISPA: Account list
        innerSegs.push(buildHISPA(segNo++, this.config.accounts, hkspa.segNo));

        return buildMessage({
            dialogId: session.dialogId,
            msgNo,
            blz: this.config.blz,
            userName,
            systemId: session.systemId,
            profileVersion,
            innerSegments: innerSegs,
        });
    }

    /**
     * Handle HKSAL (balance request).
     *
     * Reference: FinTS 3.0 specification section C.2.1.2
     */
    private handleSAL(
        session: DialogSession,
        userName: string,
        profileVersion: number,
        msgNo: number,
        hksal: ParsedSegment,
        hktan: ParsedSegment | undefined,
    ): string {
        // Extract account number from the request.
        // For version <= 6: [accountNumber, subAccount, countryCode, blz]
        // For version 7: [iban, bic, accountNumber, subAccount, countryCode, blz]
        const accountDG = hksal.dataGroups[0] || [];
        let accountNumber: string;
        if (hksal.version >= 7 && accountDG.length >= 3) {
            // Version 7 format: IBAN, BIC, accountNumber, ...
            accountNumber = accountDG[2] || accountDG[0];
        } else {
            accountNumber = accountDG[0] || "1";
        }

        // Try matching by account number first, then by IBAN
        let balance = this.config.balances.find((b) => b.accountNumber === accountNumber);
        let account = this.config.accounts.find((a) => a.accountNumber === accountNumber);

        // Fallback: try matching by IBAN (first element in version 7)
        if (!account && accountDG[0]) {
            account = this.config.accounts.find((a) => a.iban === accountDG[0]);
            if (account) {
                balance = this.config.balances.find((b) => b.accountNumber === account!.accountNumber);
            }
        }

        if (!balance || !account) {
            return this.buildErrorMessage(session.dialogId, userName, session.systemId,
                profileVersion, msgNo, "9210", "Konto nicht gefunden");
        }

        const innerSegs: string[] = [];
        let segNo = 3;

        innerSegs.push(buildHIRMG(segNo++, [
            { code: "0010", message: "Nachricht entgegengenommen." },
        ]));

        innerSegs.push(buildHIRMS(segNo++, [
            { code: "0020", message: "Auftrag ausgefuehrt" },
        ], hksal.segNo));

        innerSegs.push(buildHISAL(segNo++, {
            accountNumber: balance.accountNumber,
            subAccount: account.subAccount,
            blz: account.blz,
            productName: balance.productName,
            currency: balance.currency,
            bookedBalance: balance.bookedBalance,
            pendingBalance: balance.pendingBalance,
            creditLimit: balance.creditLimit,
            availableBalance: balance.availableBalance,
        }, hksal.segNo));

        return buildMessage({
            dialogId: session.dialogId,
            msgNo,
            blz: this.config.blz,
            userName,
            systemId: session.systemId,
            profileVersion,
            innerSegments: innerSegs,
        });
    }

    /**
     * Handle HKKAZ (statement/transaction list request).
     *
     * Returns MT940-formatted transaction data.
     * Reference: FinTS 3.0 specification section C.2.1.1.1
     */
    private handleKAZ(
        session: DialogSession,
        userName: string,
        profileVersion: number,
        msgNo: number,
        hkkaz: ParsedSegment,
        hktan: ParsedSegment | undefined,
    ): string {
        // Extract account number from the request.
        // For version <= 6: [accountNumber, subAccount, countryCode, blz]
        // For version 7: [iban, bic, accountNumber, subAccount, countryCode, blz]
        const accountDG = hkkaz.dataGroups[0] || [];
        let accountNumber: string;
        if (hkkaz.version >= 7 && accountDG.length >= 3) {
            accountNumber = accountDG[2] || accountDG[0];
        } else {
            accountNumber = accountDG[0] || "1";
        }

        let account = this.config.accounts.find((a) => a.accountNumber === accountNumber);

        // Fallback: try matching by IBAN
        if (!account && accountDG[0]) {
            account = this.config.accounts.find((a) => a.iban === accountDG[0]);
        }

        const transactions = account
            ? (this.config.transactions[account.accountNumber] || [])
            : [];

        if (!account) {
            return this.buildErrorMessage(session.dialogId, userName, session.systemId,
                profileVersion, msgNo, "9210", "Konto nicht gefunden");
        }

        const balance = this.config.balances.find((b) => b.accountNumber === accountNumber);
        const openingBalance = balance ? balance.bookedBalance - transactions.reduce((sum, tx) => sum + tx.amount, 0) : 0;
        const mt940 = generateMT940(account, transactions, openingBalance);

        const innerSegs: string[] = [];
        let segNo = 3;

        innerSegs.push(buildHIRMG(segNo++, [
            { code: "0010", message: "Nachricht entgegengenommen." },
        ]));

        innerSegs.push(buildHIRMS(segNo++, [
            { code: "0020", message: "Auftrag ausgefuehrt" },
        ], hkkaz.segNo));

        innerSegs.push(buildHIKAZ(segNo++, mt940, hkkaz.segNo));

        return buildMessage({
            dialogId: session.dialogId,
            msgNo,
            blz: this.config.blz,
            userName,
            systemId: session.systemId,
            profileVersion,
            innerSegments: innerSegs,
        });
    }

    /**
     * Handle HKCDB (standing orders request).
     *
     * Reference: FinTS 3.0 specification section C.10.2.3
     */
    private handleCDB(
        session: DialogSession,
        userName: string,
        profileVersion: number,
        msgNo: number,
        hkcdb: ParsedSegment,
        hktan: ParsedSegment | undefined,
    ): string {
        const innerSegs: string[] = [];
        let segNo = 3;

        innerSegs.push(buildHIRMG(segNo++, [
            { code: "0010", message: "Nachricht entgegengenommen." },
        ]));

        innerSegs.push(buildHIRMS(segNo++, [
            { code: "0020", message: "Auftrag ausgefuehrt" },
        ], hkcdb.segNo));

        // No standing orders in test data by default (empty response is valid)

        return buildMessage({
            dialogId: session.dialogId,
            msgNo,
            blz: this.config.blz,
            userName,
            systemId: session.systemId,
            profileVersion,
            innerSegments: innerSegs,
        });
    }

    /**
     * Handle HKCCS (credit transfer request).
     *
     * If requireTan is enabled, responds with TAN challenge (0030 return code).
     * Reference: FinTS 3.0 specification section C.10.3.1
     */
    private handleCCS(
        session: DialogSession,
        userName: string,
        profileVersion: number,
        msgNo: number,
        hkccs: ParsedSegment,
        hktan: ParsedSegment | undefined,
    ): string {
        const innerSegs: string[] = [];
        let segNo = 3;

        if (this.config.requireTan) {
            // Return TAN challenge
            innerSegs.push(buildHIRMG(segNo++, [
                { code: "0010", message: "Nachricht entgegengenommen." },
            ]));
            innerSegs.push(buildHIRMS(segNo++, [
                { code: "0030", message: "Auftrag empfangen - Loss bitte eine TAN ein" },
            ], hkccs.segNo));
            innerSegs.push(buildHITAN(segNo++, {
                process: "4",
                transactionReference: `TAN-REF-${Date.now()}`,
                challengeText: "Bitte geben Sie die TAN ein",
            }, hkccs.segNo));
        } else {
            innerSegs.push(buildHIRMG(segNo++, [
                { code: "0010", message: "Nachricht entgegengenommen." },
            ]));
            innerSegs.push(buildHIRMS(segNo++, [
                { code: "0020", message: "Auftrag ausgefuehrt" },
            ], hkccs.segNo));
        }

        return buildMessage({
            dialogId: session.dialogId,
            msgNo,
            blz: this.config.blz,
            userName,
            systemId: session.systemId,
            profileVersion,
            innerSegments: innerSegs,
        });
    }

    /**
     * Handle HKDSE (direct debit request).
     *
     * Reference: FinTS 3.0 specification section C.10.3.2
     */
    private handleDSE(
        session: DialogSession,
        userName: string,
        profileVersion: number,
        msgNo: number,
        hkdse: ParsedSegment,
        hktan: ParsedSegment | undefined,
    ): string {
        const innerSegs: string[] = [];
        let segNo = 3;

        if (this.config.requireTan) {
            innerSegs.push(buildHIRMG(segNo++, [
                { code: "0010", message: "Nachricht entgegengenommen." },
            ]));
            innerSegs.push(buildHIRMS(segNo++, [
                { code: "0030", message: "Auftrag empfangen - Bitte eine TAN eingeben" },
            ], hkdse.segNo));
            innerSegs.push(buildHITAN(segNo++, {
                process: "4",
                transactionReference: `TAN-REF-${Date.now()}`,
                challengeText: "Bitte geben Sie die TAN ein",
            }, hkdse.segNo));
        } else {
            innerSegs.push(buildHIRMG(segNo++, [
                { code: "0010", message: "Nachricht entgegengenommen." },
            ]));
            innerSegs.push(buildHIRMS(segNo++, [
                { code: "0020", message: "Auftrag ausgefuehrt" },
            ], hkdse.segNo));
        }

        return buildMessage({
            dialogId: session.dialogId,
            msgNo,
            blz: this.config.blz,
            userName,
            systemId: session.systemId,
            profileVersion,
            innerSegments: innerSegs,
        });
    }

    /**
     * Handle standalone HKTAN (TAN submission/process).
     *
     * Reference: FinTS 3.0 PINTAN specification
     */
    private handleTAN(
        session: DialogSession,
        userName: string,
        profileVersion: number,
        msgNo: number,
        hktan: ParsedSegment,
    ): string {
        const innerSegs: string[] = [];
        let segNo = 3;

        innerSegs.push(buildHIRMG(segNo++, [
            { code: "0010", message: "Nachricht entgegengenommen." },
        ]));

        innerSegs.push(buildHIRMS(segNo++, [
            { code: "0020", message: "Auftrag ausgefuehrt" },
        ], hktan.segNo));

        return buildMessage({
            dialogId: session.dialogId,
            msgNo,
            blz: this.config.blz,
            userName,
            systemId: session.systemId,
            profileVersion,
            innerSegments: innerSegs,
        });
    }

    /**
     * Build a generic error response message.
     */
    private buildErrorMessage(
        dialogId: string,
        userName: string,
        systemId: string,
        profileVersion: number,
        msgNo: number,
        errorCode: string,
        errorMessage: string,
    ): string {
        return buildMessage({
            dialogId: dialogId || "0",
            msgNo,
            blz: this.config.blz,
            userName,
            systemId,
            profileVersion,
            innerSegments: [
                buildHIRMG(3, [
                    { code: errorCode, message: errorMessage },
                ]),
            ],
        });
    }

    /**
     * Reset all sessions. Useful for testing.
     */
    public reset(): void {
        this.sessions.clear();
        dialogCounter = 10000000;
    }
}
