import { Response } from "../response";
import { formatErrorCode } from "../error-codes";

export class ResponseError extends Error {
    public response: Response;
    public errors: string[];

    constructor(response: Response) {
        const errors = Array.from(response.returnValues().values())
            .filter((value) => value.error)
            .map((value) => formatErrorCode(value.code, value.message));

        super(`Error(s) in dialog: ${errors.join(", ")}.`);
        this.response = response;
        this.errors = errors;

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ResponseError);
        }
    }
}
