/**
 * Placeholder definitions for SEPA pain.001.001.03 structures.
 * The real XSD-derived types are not included in this repository.
 */

export interface Pain001Document {
    Document: { CstmrCdtTrfInitn: CustomerCreditTransferInitiationV03 };
}

export interface CustomerCreditTransferInitiationV03 {
    GrpHdr: { CreDtTm: string; CtrlSum: number };
    PmtInf: PaymentInstructionInformationSCT | PaymentInstructionInformationSCT[];
}

export interface PaymentInstructionInformationSCT {
    Dbtr: { Nm: string };
    DbtrAcct: { Id: { IBAN: string } };
    DbtrAgt: { FinInstnId: { BIC: string } };
    CdtTrfTxInf: CreditTransferTransactionInformationSCT | CreditTransferTransactionInformationSCT[];
}

export interface CreditTransferTransactionInformationSCT {
    Cdtr: { Nm: string };
    CdtrAcct: { Id: { IBAN: string } };
    CdtrAgt: { FinInstnId: { BIC: string } };
    RmtInf: { Ustrd: string };
}
