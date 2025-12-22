/**
 * FinTS Error and Return Code Mappings
 * Based on FinTS 3.0 specification
 *
 * Code ranges:
 * 0xxx - Success messages
 * 3xxx - Warnings
 * 9xxx - Errors
 */

export interface FinTSErrorCodeInfo {
    code: string;
    message: string;
    category: "success" | "warning" | "error";
    description: string;
}

/**
 * Complete mapping of FinTS return codes
 */
export const FINTS_ERROR_CODES: Record<string, FinTSErrorCodeInfo> = {
    // Success codes (0xxx)
    "0010": {
        code: "0010",
        message: "Nachricht entgegengenommen",
        category: "success",
        description: "Message successfully received",
    },
    "0020": {
        code: "0020",
        message: "Dialoginitialisierung erfolgreich",
        category: "success",
        description: "Dialog initialization successful",
    },
    "0030": {
        code: "0030",
        message: "Auftrag entgegengenommen - Sicherheitsfreigabe erforderlich",
        category: "success",
        description: "Order received - TAN/Security clearance required",
    },
    "0100": {
        code: "0100",
        message: "Dialog beendet",
        category: "success",
        description: "Dialog ended successfully",
    },

    // Warning codes (3xxx)
    "3010": {
        code: "3010",
        message: "Teilweise fehlerhaft",
        category: "warning",
        description: "Partially erroneous",
    },
    "3040": {
        code: "3040",
        message: "Auftragsdaten liegen nicht vollständig vor - weitere Auftragsdaten benötigt",
        category: "warning",
        description: "Order data not complete - more data needed (touchdown)",
    },
    "3050": {
        code: "3050",
        message: "Auftragsart derzeit nicht zugelassen",
        category: "warning",
        description: "Order type currently not permitted",
    },
    "3060": {
        code: "3060",
        message: "Teilweise fehlerhaft, Restdaten folgen",
        category: "warning",
        description: "Partially erroneous, remaining data follows",
    },
    "3076": {
        code: "3076",
        message: "Starke Kundenauthentifizierung notwendig",
        category: "warning",
        description: "Strong customer authentication necessary (PSD2)",
    },
    "3920": {
        code: "3920",
        message: "Zugelassene Zwei-Schritt-Verfahren für den Benutzer",
        category: "warning",
        description: "Permitted two-step procedures for the user",
    },
    "3956": {
        code: "3956",
        message: "Starke Kundenauthentifizierung notwendig",
        category: "warning",
        description: "Strong customer authentication necessary",
    },

    // Error codes (9xxx)
    "9010": {
        code: "9010",
        message: "Nachrichtenaufbau fehlerhaft",
        category: "error",
        description: "Message structure error",
    },
    "9030": {
        code: "9030",
        message: "Nachrichtenkopf fehlerhaft",
        category: "error",
        description: "Message header error",
    },
    "9040": {
        code: "9040",
        message: "Nachrichten-Ende fehlerhaft",
        category: "error",
        description: "Message end error",
    },
    "9050": {
        code: "9050",
        message: "Nachrichtensignatur fehlerhaft oder fehlt",
        category: "error",
        description: "Message signature error or missing",
    },
    "9070": {
        code: "9070",
        message: "Test-BPD/UPD nicht mehr aktuell",
        category: "error",
        description: "Test BPD/UPD no longer current",
    },
    "9080": {
        code: "9080",
        message: "Teilnehmer im Testsystem nicht vorhanden",
        category: "error",
        description: "Participant not present in test system",
    },
    "9110": {
        code: "9110",
        message: "Kunde nicht berechtigt",
        category: "error",
        description: "Customer not authorized",
    },
    "9120": {
        code: "9120",
        message: "Auftrag nicht zugelassen",
        category: "error",
        description: "Order not permitted",
    },
    "9130": {
        code: "9130",
        message: "Maximale Anzahl Aufträge überschritten",
        category: "error",
        description: "Maximum number of orders exceeded",
    },
    "9140": {
        code: "9140",
        message: "Geschäftsvorfall nicht zugelassen",
        category: "error",
        description: "Business transaction not permitted",
    },
    "9210": {
        code: "9210",
        message: "Feature nicht unterstützt",
        category: "error",
        description: "Feature not supported",
    },
    "9340": {
        code: "9340",
        message: "Nachricht abgelehnt",
        category: "error",
        description: "Message rejected",
    },
    "9380": {
        code: "9380",
        message: "Dialog abgebrochen",
        category: "error",
        description: "Dialog aborted",
    },
    "9390": {
        code: "9390",
        message: "Nachricht doppelt",
        category: "error",
        description: "Duplicate message",
    },
    "9800": {
        code: "9800",
        message: "Dialog/Nachricht abgebrochen",
        category: "error",
        description: "Dialog/Message aborted",
    },
    "9931": {
        code: "9931",
        message: "Kundensystem-ID ungültig",
        category: "error",
        description: "Customer system ID invalid",
    },
    "9942": {
        code: "9942",
        message: "PIN falsch",
        category: "error",
        description: "PIN incorrect",
    },
};

/**
 * Get error code information
 */
export function getErrorCodeInfo(code: string): FinTSErrorCodeInfo | undefined {
    return FINTS_ERROR_CODES[code];
}

/**
 * Check if a code represents a success
 */
export function isSuccessCode(code: string): boolean {
    return code.startsWith("0");
}

/**
 * Check if a code represents a warning
 */
export function isWarningCode(code: string): boolean {
    return code.startsWith("3");
}

/**
 * Check if a code represents an error
 */
export function isErrorCode(code: string): boolean {
    return code.startsWith("9");
}

/**
 * Get a human-readable error message with code
 */
export function formatErrorCode(code: string, originalMessage?: string): string {
    const info = getErrorCodeInfo(code);
    if (info) {
        return `[${code}] ${info.message}${originalMessage && originalMessage !== info.message ? ` - ${originalMessage}` : ""}`;
    }
    return originalMessage ? `[${code}] ${originalMessage}` : `[${code}] Unknown error code`;
}
