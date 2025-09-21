import { Pain001Schema } from "./types";

export interface document {
    Document: { CstmrCdtTrfInitn: CustomerCreditTransferInitiationV03 };
}

export interface CustomerCreditTransferInitiationV03 {
    GrpHdr: GroupHeaderSCT;
    PmtInf: PaymentInstructionInformationSCT | PaymentInstructionInformationSCT[];
}

export interface GroupHeaderSCT {
    MsgId: string;
    CreDtTm: string;
    NbOfTxs: string;
    CtrlSum: number | string;
    InitgPty: { Nm: string };
}

export interface PaymentInstructionInformationSCT {
    PmtInfId: string;
    PmtMtd: string;
    NbOfTxs: string;
    CtrlSum: number | string;
    PmtTpInf: { SvcLvl: { Cd: string } };
    ReqdExctnDt: string | { Dt: string };
    Dbtr: { Nm: string };
    DbtrAcct: { Id: { IBAN: string } };
    DbtrAgt: { FinInstnId: { BIC: string } };
    ChrgBr: string;
    CdtTrfTxInf: CreditTransferTransactionInformationSCT | CreditTransferTransactionInformationSCT[];
}

export interface CreditTransferTransactionInformationSCT {
    PmtId: { EndToEndId: string };
    Amt: { InstdAmt: { "@_Ccy": string; "#text": string } };
    CdtrAgt?: { FinInstnId: { BIC: string } };
    Cdtr: { Nm: string };
    CdtrAcct: { Id: { IBAN: string } };
    RmtInf?: { Ustrd: string };
}

export interface Pain001Message {
    xml: string;
    schema: Pain001Schema;
    messageId: string;
    paymentInformationId: string;
    numberOfTransactions: number;
    controlSum: number;
}

export { buildPain001Message, resolvePainDescriptor } from "./pain-builder";
