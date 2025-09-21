declare module "fints" {
    export const PRODUCT_NAME: string;
    export type PinTanClientConfig = any;
    export interface CreditTransferRequest { [key: string]: any; }
    export interface CreditTransferSubmission { [key: string]: any; }
    export interface DirectDebitRequest { [key: string]: any; }
    export interface DirectDebitSubmission { [key: string]: any; }
    export class TanRequiredError extends Error {
        dialog: any;
        transactionReference: string;
        challengeText?: string;
        creditTransferSubmission?: CreditTransferSubmission;
        directDebitSubmission?: DirectDebitSubmission;
    }
    export class PinTanClient {
        constructor(config: any);
        accounts(): Promise<any[]>;
        statements(account: any, start: Date, end: Date): Promise<any[]>;
        creditTransfer(account: any, request: CreditTransferRequest): Promise<CreditTransferSubmission>;
        completeCreditTransfer(dialog: any, transactionReference: string, tan: string, submission: CreditTransferSubmission): Promise<CreditTransferSubmission>;
        directDebit(account: any, request: DirectDebitRequest): Promise<DirectDebitSubmission>;
        completeDirectDebit(dialog: any, transactionReference: string, tan: string, submission: DirectDebitSubmission): Promise<DirectDebitSubmission>;
    }
    export const logger: any;
}
