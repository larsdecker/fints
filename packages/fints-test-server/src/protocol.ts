/**
 * FinTS protocol utilities for the test server.
 * Implements message parsing and encoding according to FinTS 3.0 specification.
 */
import iconv from "iconv-lite";

/**
 * Encode a string to Base64 using ISO-8859-1 encoding (FinTS standard).
 */
export function encodeBase64(input: string): string {
    return Buffer.from(iconv.encode(input, "ISO-8859-1")).toString("base64");
}

/**
 * Decode a Base64 string from FinTS (ISO-8859-1 → UTF-8).
 */
export function decodeBase64(input: string): string {
    return iconv.decode(Buffer.from(input, "base64"), "ISO-8859-1");
}

/**
 * Escape a string for FinTS representation.
 * Control characters (? + : ' @) must be prefixed with '?'.
 */
export function escapeFinTS(content: string): string {
    if (typeof content === "undefined" || content === null) {
        return "";
    }
    return content
        .replace(/\?/g, "??")
        .replace(/\+/g, "?+")
        .replace(/:/g, "?:")
        .replace(/'/g, "?'")
        .replace(/@/g, "?@");
}

/**
 * Parse a FinTS message string into segments → data groups → data elements.
 * Handles binary data (@length@data), escape sequences (?X), and all delimiters.
 *
 * Section B.1 of the FinTS specification.
 */
export function parse(input: string): string[][][] {
    if (input.length === 0) return [];
    if (input[input.length - 1] !== "'") {
        throw new Error(`String must end with "'"`);
    }

    const segments: string[][][] = [];
    let groups: string[][] = [];
    let elements: string[] = [];
    let str = "";
    let escapeActive = false;

    const flushSegment = () => {
        flushGroup();
        segments.push(groups);
        groups = [];
    };

    const flushGroup = () => {
        flushElement();
        groups.push(elements);
        elements = [];
    };

    const flushElement = () => {
        elements.push(str);
        str = "";
    };

    for (let i = 0; i < input.length; ++i) {
        const character = input.charAt(i);

        if (escapeActive) {
            str += character;
            escapeActive = false;
            continue;
        }

        switch (character) {
            case "@": {
                i++;
                let lengthString = "";
                for (; i < input.length; ++i) {
                    if (input.charAt(i) === "@") break;
                    lengthString += input.charAt(i);
                }
                i++;
                const endIndex = i + Number(lengthString);
                for (; i < endIndex; ++i) {
                    str += input.charAt(i);
                }
                i--;
                break;
            }
            case "?":
                escapeActive = true;
                break;
            case "'":
                flushSegment();
                break;
            case "+":
                flushGroup();
                break;
            case ":":
                flushElement();
                break;
            default:
                str += character;
                break;
        }
    }

    return segments;
}

/**
 * Left-pad a string with a character to a target length.
 */
export function leftPad(str: string, count: number, character = "0"): string {
    while (str.length < count) {
        str = `${character}${str}`;
    }
    return str;
}

/**
 * Format a date as FinTS date string (yyyyMMdd).
 */
export function formatDate(date?: Date): string {
    const d = date || new Date();
    const y = d.getFullYear();
    const m = leftPad(String(d.getMonth() + 1), 2);
    const day = leftPad(String(d.getDate()), 2);
    return `${y}${m}${day}`;
}

/**
 * Format a time as FinTS time string (HHmmss).
 */
export function formatTime(date?: Date): string {
    const d = date || new Date();
    const h = leftPad(String(d.getHours()), 2);
    const m = leftPad(String(d.getMinutes()), 2);
    const s = leftPad(String(d.getSeconds()), 2);
    return `${h}${m}${s}`;
}

/**
 * Format a number for FinTS (replaces '.' with ',').
 */
export function formatNum(num: number): string {
    return `${num}`.replace(/\./, ",");
}

/**
 * Format a binary string with length specifier (@length@content).
 */
export function formatStringWithLength(str: string): string {
    return `@${str.length}@${str}`;
}

/**
 * Left-pad a number to 12 digits (FinTS "dig" format).
 */
export function formatDig(num: number): string {
    return leftPad(String(num), 12);
}

/**
 * Represents a parsed FinTS segment from an incoming request.
 */
export interface ParsedSegment {
    /** Segment type (e.g., "HKIDN", "HKVVB") */
    type: string;
    /** Segment number within the message */
    segNo: number;
    /** Segment version */
    version: number;
    /** Referenced segment number (optional) */
    reference?: number;
    /** Raw data groups (excluding the header) */
    dataGroups: string[][];
}

/**
 * Parse a raw segment (string[][][]) into a structured ParsedSegment.
 */
export function parseSegment(raw: string[][]): ParsedSegment {
    const header = raw[0];
    const result: ParsedSegment = {
        type: header[0],
        segNo: Number(header[1]),
        version: Number(header[2]),
        dataGroups: raw.slice(1),
    };
    if (header.length > 3) {
        result.reference = Number(header[3]);
    }
    return result;
}

/**
 * Extract segments from an HNVSD envelope (encrypted data segment).
 * The HNVSD segment contains the actual payload wrapped in @length@ notation.
 */
export function extractInnerSegments(segments: ParsedSegment[]): ParsedSegment[] {
    const hnvsd = segments.find((s) => s.type === "HNVSD");
    if (!hnvsd) return [];

    const innerContent = hnvsd.dataGroups[0]?.[0];
    if (!innerContent) return [];

    const innerParsed = parse(innerContent);
    return innerParsed.map(parseSegment);
}
