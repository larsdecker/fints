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
 * Factory function to create appropriate error based on error code
 */
export function createFinTSError(code: string, message: string, returnValue?: ReturnValue): FinTSError {
    const formattedMessage = formatErrorCode(code, message);

    // Authentication errors
    if (["9110", "9942"].includes(code)) {
        if (code === "9942") {
            return new PinError(formattedMessage, code, returnValue);
        }
        return new AuthenticationError(formattedMessage, code, returnValue);
    }

    // Strong authentication required (PSD2)
    if (["3076", "3956"].includes(code)) {
        return new StrongAuthenticationRequiredError(formattedMessage, code, returnValue);
    }

    // Order/transaction errors
    if (["9120", "9140", "9340"].includes(code)) {
        return new OrderRejectedError(formattedMessage, code, returnValue);
    }

    // Dialog errors
    if (["9380", "9800"].includes(code)) {
        return new DialogAbortedError(formattedMessage, code, returnValue);
    }

    // Message structure errors
    if (["9010", "9030", "9040"].includes(code)) {
        return new MessageStructureError(formattedMessage, code, returnValue);
    }

    // System ID errors
    if (["9931", "9070"].includes(code)) {
        return new InvalidSystemIdError(formattedMessage, code, returnValue);
    }

    // Generic FinTS error
    return new FinTSError(formattedMessage, code, returnValue);
}
