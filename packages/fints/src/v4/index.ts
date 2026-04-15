/**
 * FinTS 4.1 module exports.
 */
export { FinTS4Client } from "./client";
export { FinTS4Dialog, FinTS4TanRequiredError } from "./dialog";
export { FinTS4HttpConnection, createTlsAgent } from "./connection";
export type { FinTS4ConnectionConfig } from "./connection";
export type {
    FinTS4ClientConfig,
    FinTS4DialogConfig,
    FinTS4Connection,
    FinTS4Response,
    FinTS4ReturnValue,
    BankParameterData,
    UserParameterData,
    UserAccount,
    CamtStatement,
    CamtEntry,
    MsgHead,
    MsgTail,
    TanChallenge,
    TanCallback,
    FinTS4TlsOptions,
} from "./types";
export {
    FINTS_VERSION,
    FINTS_NAMESPACE,
    CAMT_053_NAMESPACE,
    CAMT_052_NAMESPACE,
    SUPPORTED_CAMT_FORMATS,
} from "./constants";
export {
    buildMessage,
    buildMsgHead,
    buildMsgTail,
    buildSecurityEnvelope,
    buildSegment,
    escapeXml,
    xmlElement,
    xmlEmptyElement,
} from "./xml-builder";
export type { XmlSegment, XmlMessageOptions } from "./xml-builder";
export {
    parseResponse,
    isFinTS4Response,
    getXmlValue,
    getXmlString,
    getXmlNumber,
    ensureArray,
    isErrorCode as isFinTS4ErrorCode,
    findSegment,
    findSegments,
} from "./xml-parser";
export { parseCamt053, parseCamt052 } from "./camt-parser";
export {
    buildDialogInitSegment,
    buildDialogEndSegment,
    buildSyncSegment,
    buildAccountListSegment,
    buildBalanceSegment,
    buildAccountStatementSegment,
    buildTanSegment,
    buildTanSubmitSegment,
} from "./segments";
