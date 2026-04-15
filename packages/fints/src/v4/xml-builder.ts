/**
 * XML message builder for FinTS 4.1 protocol.
 *
 * Constructs well-formed XML messages conforming to the FinTS 4.1 specification.
 */
import { FINTS_NAMESPACE, FINTS_VERSION, XML_DECLARATION, COUNTRY_CODE } from "./constants";
import { PRODUCT_NAME, PRODUCT_VERSION } from "../constants";

/**
 * Options for building a FinTS 4.1 XML segment.
 */
export interface XmlSegment {
    /** Segment type identifier (e.g., "DialogInit", "Sync", "HKCAZ"). */
    type: string;
    /** Segment version. */
    version: number;
    /** Segment number within the message. */
    segNo: number;
    /** XML content of the segment body. */
    body: string;
}

/**
 * Options for building a complete FinTS 4.1 XML message.
 */
export interface XmlMessageOptions {
    /** Message number. */
    msgNo: number;
    /** Dialog ID (use "0" for initial messages). */
    dialogId: string;
    /** Business segments in the message body. */
    segments: XmlSegment[];
    /** BLZ (bank code). */
    blz: string;
    /** User name / customer ID. */
    name: string;
    /** PIN for authentication. */
    pin?: string;
    /** System ID. */
    systemId: string;
    /** Product ID. */
    productId?: string;
    /** TAN if required. */
    tan?: string;
    /** Security function to use. */
    securityFunction?: string;
    /**
     * HBCI protocol version string used in MsgHead (e.g. "4.1", "4.0").
     * Defaults to the module constant FINTS_VERSION when omitted.
     */
    hbciVersion?: string;
}

/**
 * Escape special XML characters in a string value.
 */
export function escapeXml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

/**
 * Build a FinTS 4.1 XML element with the given tag, attributes, and content.
 */
export function xmlElement(tag: string, content: string, attributes?: Record<string, string>): string {
    const attrStr = attributes
        ? Object.entries(attributes)
              .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
              .join("")
        : "";
    return `<${tag}${attrStr}>${content}</${tag}>`;
}

/**
 * Build a self-closing XML element.
 */
export function xmlEmptyElement(tag: string, attributes?: Record<string, string>): string {
    const attrStr = attributes
        ? Object.entries(attributes)
              .map(([k, v]) => ` ${k}="${escapeXml(v)}"`)
              .join("")
        : "";
    return `<${tag}${attrStr}/>`;
}

/**
 * Build the MsgHead (message header) for a FinTS 4.1 message.
 */
export function buildMsgHead(options: {
    msgNo: number;
    dialogId: string;
    blz: string;
    systemId: string;
    productId?: string;
    hbciVersion?: string;
}): string {
    const productId = options.productId || PRODUCT_NAME;
    const version = options.hbciVersion || FINTS_VERSION;
    return xmlElement(
        "MsgHead",
        xmlElement("MsgNo", String(options.msgNo)) +
            xmlElement("DialogID", escapeXml(options.dialogId)) +
            xmlElement("HBCIVersion", version) +
            xmlElement(
                "Initiator",
                xmlElement("BLZ", options.blz) +
                    xmlElement("CountryCode", COUNTRY_CODE) +
                    xmlElement("SystemID", escapeXml(options.systemId)),
            ) +
            xmlElement("Product", xmlElement("Name", escapeXml(productId)) + xmlElement("Version", PRODUCT_VERSION)),
    );
}

/**
 * Build the MsgTail (message trailer) for a FinTS 4.1 message.
 */
export function buildMsgTail(msgNo: number): string {
    return xmlElement("MsgTail", xmlElement("MsgNo", String(msgNo)));
}

/**
 * Build the security envelope (SignatureHeader and SignatureTrailer) for PIN/TAN.
 */
export function buildSecurityEnvelope(options: {
    pin?: string;
    tan?: string;
    name: string;
    systemId: string;
    securityFunction?: string;
}): { header: string; trailer: string } {
    const secFunc = options.securityFunction || "999";
    const header = xmlElement(
        "SignatureHeader",
        xmlElement("SecurityFunction", secFunc) +
            xmlElement("SecurityMethod", "PIN_TAN") +
            xmlElement("UserID", escapeXml(options.name)) +
            xmlElement("SystemID", escapeXml(options.systemId)),
    );

    let trailerContent = "";
    if (options.pin) {
        trailerContent += xmlElement("PIN", escapeXml(options.pin));
    }
    if (options.tan) {
        trailerContent += xmlElement("TAN", escapeXml(options.tan));
    }
    const trailer = xmlElement("SignatureTrailer", trailerContent);
    return { header, trailer };
}

/**
 * Wrap a segment's body content in a Segment XML element.
 */
export function buildSegment(segment: XmlSegment): string {
    return xmlElement(
        "Segment",
        xmlElement(
            "SegHead",
            xmlElement("Type", segment.type) +
                xmlElement("Version", String(segment.version)) +
                xmlElement("SegNo", String(segment.segNo)),
        ) + xmlElement("SegBody", segment.body),
    );
}

/**
 * Build a complete FinTS 4.1 XML message.
 */
export function buildMessage(options: XmlMessageOptions): string {
    const msgHead = buildMsgHead({
        msgNo: options.msgNo,
        dialogId: options.dialogId,
        blz: options.blz,
        systemId: options.systemId,
        productId: options.productId,
        hbciVersion: options.hbciVersion,
    });

    const security = buildSecurityEnvelope({
        pin: options.pin,
        tan: options.tan,
        name: options.name,
        systemId: options.systemId,
        securityFunction: options.securityFunction,
    });

    const segmentsXml = options.segments.map(buildSegment).join("");

    const msgBody = xmlElement("MsgBody", security.header + segmentsXml + security.trailer);

    const msgTail = buildMsgTail(options.msgNo);

    const content = msgHead + msgBody + msgTail;

    return XML_DECLARATION + xmlElement("FinTSMessage", content, { xmlns: FINTS_NAMESPACE });
}
