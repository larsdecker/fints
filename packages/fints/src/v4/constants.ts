/**
 * Constants specific to the FinTS 4.1 protocol.
 */

/**
 * The FinTS protocol version identifier for version 4.1.
 */
export const FINTS_VERSION = "4.1";

/**
 * XML namespace for FinTS 4.1 messages.
 */
export const FINTS_NAMESPACE = "urn:org:fints:4.1";

/**
 * XML namespace for camt.053 (Bank-to-Customer Statement).
 */
export const CAMT_053_NAMESPACE = "urn:iso:std:iso:20022:tech:xsd:camt.053.001.02";

/**
 * XML namespace for camt.052 (Bank-to-Customer Account Report).
 */
export const CAMT_052_NAMESPACE = "urn:iso:std:iso:20022:tech:xsd:camt.052.001.02";

/**
 * Country code for Germany.
 */
export const COUNTRY_CODE = "280";

/**
 * Default language code (German).
 */
export const LANG_DE = "de";

/**
 * Security method: PIN/TAN.
 */
export const SECURITY_METHOD_PIN_TAN = "PIN_TAN";

/**
 * Default segment version for v4.1 segments.
 */
export const DEFAULT_SEGMENT_VERSION = 1;

/**
 * XML declaration for messages.
 */
export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

/**
 * Supported camt formats for account statements in v4.1.
 */
export const SUPPORTED_CAMT_FORMATS = [
    "urn:iso:std:iso:20022:tech:xsd:camt.053.001.02",
    "urn:iso:std:iso:20022:tech:xsd:camt.052.001.02",
] as const;
