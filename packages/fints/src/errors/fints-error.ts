import { ReturnValue } from "../return-value";
import { formatErrorCode } from "../error-codes";

/**
 * Base class for FinTS-specific errors with enhanced error information
 */
export class FinTSError extends Error {
    public code: string;
    public returnValue?: ReturnValue;

    constructor(message: string, code?: string, returnValue?: ReturnValue) {
        super(message);
        this.name = "FinTSError";
        this.code = code || "UNKNOWN";
        this.returnValue = returnValue;

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, FinTSError);
        }
    }
}

/**
 * Error thrown when customer authentication fails
 */
export class AuthenticationError extends FinTSError {
    constructor(message: string, code?: string, returnValue?: ReturnValue) {
        super(message, code, returnValue);
        this.name = "AuthenticationError";
    }
}

/**
 * Error thrown when an order/transaction is rejected
 */
export class OrderRejectedError extends FinTSError {
    constructor(message: string, code?: string, returnValue?: ReturnValue) {
        super(message, code, returnValue);
        this.name = "OrderRejectedError";
    }
}

/**
 * Error thrown when the dialog is aborted by the server
 */
export class DialogAbortedError extends FinTSError {
    constructor(message: string, code?: string, returnValue?: ReturnValue) {
        super(message, code, returnValue);
        this.name = "DialogAbortedError";
    }
}

/**
 * Error thrown when a message has structural errors
 */
export class MessageStructureError extends FinTSError {
    constructor(message: string, code?: string, returnValue?: ReturnValue) {
        super(message, code, returnValue);
        this.name = "MessageStructureError";
    }
}

/**
 * Error thrown when a PIN is incorrect
 */
export class PinError extends FinTSError {
    constructor(message: string, code?: string, returnValue?: ReturnValue) {
        super(message, code, returnValue);
        this.name = "PinError";
    }
}

/**
 * Error thrown when strong customer authentication is required (PSD2)
 */
export class StrongAuthenticationRequiredError extends FinTSError {
    constructor(message: string, code?: string, returnValue?: ReturnValue) {
        super(message, code, returnValue);
        this.name = "StrongAuthenticationRequiredError";
    }
}

/**
 * Error thrown when system/customer ID is invalid
 */
export class InvalidSystemIdError extends FinTSError {
    constructor(message: string, code?: string, returnValue?: ReturnValue) {
        super(message, code, returnValue);
        this.name = "InvalidSystemIdError";
    }
}

/**
 * Type alias for error class constructors
 */
type ErrorConstructor = new (message: string, code: string, returnValue?: ReturnValue) => FinTSError;

/**
 * Mapping of error codes to error class constructors
 */
const ERROR_CODE_MAPPINGS: Record<string, ErrorConstructor> = {
    // PIN errors
    9942: PinError,
    // Authentication errors
    9110: AuthenticationError,
    // Strong authentication required (PSD2)
    3076: StrongAuthenticationRequiredError,
    3956: StrongAuthenticationRequiredError,
    // Order/transaction errors
    9120: OrderRejectedError,
    9140: OrderRejectedError,
    9340: OrderRejectedError,
    // Dialog errors
    9380: DialogAbortedError,
    9800: DialogAbortedError,
    // Message structure errors
    9010: MessageStructureError,
    9030: MessageStructureError,
    9040: MessageStructureError,
    // System ID errors
    9931: InvalidSystemIdError,
    9070: InvalidSystemIdError,
};

/**
 * Factory function to create appropriate error based on error code
 */
export function createFinTSError(code: string, message: string, returnValue?: ReturnValue): FinTSError {
    const formattedMessage = formatErrorCode(code, message);

    // Look up the appropriate error class based on error code
    const ErrorClass = ERROR_CODE_MAPPINGS[code];
    if (ErrorClass) {
        return new ErrorClass(formattedMessage, code, returnValue);
    }

    // Generic FinTS error for unmapped codes
    return new FinTSError(formattedMessage, code, returnValue);
}
