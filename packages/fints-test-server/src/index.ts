/**
 * FinTS Test Server
 *
 * A mock FinTS 3.0 banking server for integration testing.
 * Implements the full FinTS protocol over HTTP with configurable test data.
 *
 * @packageDocumentation
 */

export { FinTSServer } from "./server";
export type { FinTSServerOptions } from "./server";
export { FinTSRequestHandler } from "./request-handler";
export {
    createDefaultConfig,
    generateMT940,
} from "./test-data";
export type {
    FinTSTestConfig,
    TestAccount,
    TestBalance,
    TestTransaction,
    TestUser,
} from "./test-data";
export {
    encodeBase64,
    decodeBase64,
    parse,
    parseSegment,
    escapeFinTS,
} from "./protocol";
export type { ParsedSegment } from "./protocol";
