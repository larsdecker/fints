/**
 * Placeholder definitions for SEPA pain.001.001.03 structures.
 * The real XSD-derived types are not included in this repository.
 */

import { formatISO } from "date-fns";
import { Parse } from "./parse";
import { Format } from "./format";
import { SEPAAccount, StandingOrderPayment, StandingOrderSchedule } from "./types";

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

export interface BuildStandingOrderPain001Options {
    account: SEPAAccount;
    payment: StandingOrderPayment;
    schedule: StandingOrderSchedule;
    messageId?: string;
    creationDateTime?: Date;
}

export interface StandingOrderPain002Status {
    status: string;
    additionalInformation?: string;
}

function escapeXml(value: string | number | undefined | null): string {
    if (value === undefined || value === null) { return ""; }
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function defaultDebitor(account: SEPAAccount): { name: string; iban: string; bic: string } {
    return {
        name: account.accountOwnerName || account.accountName || "",
        iban: account.iban,
        bic: account.bic,
    };
}

function amountToString(amount: number): string {
    return amount.toFixed(2);
}

export function buildStandingOrderPain001(options: BuildStandingOrderPain001Options): string {
    const { account, payment, schedule } = options;
    const debtor = payment.debitor || defaultDebitor(account);
    const messageId = options.messageId || `SO-${Date.now()}`;
    const creationDate = options.creationDateTime || options.schedule.startDate || new Date();
    const currency = payment.currency || "EUR";
    const instructionId = payment.instructionId || messageId;
    const endToEndId = payment.endToEndId || "NOTPROVIDED";
    const executionDate = Format.date(schedule.startDate);

    return [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        "<Document xmlns=\"urn:iso:std:iso:20022:tech:xsd:pain.001.001.03\">",
        "  <CstmrCdtTrfInitn>",
        "    <GrpHdr>",
        `      <MsgId>${escapeXml(messageId)}</MsgId>`,
        `      <CreDtTm>${escapeXml(formatISO(creationDate))}</CreDtTm>`,
        "      <NbOfTxs>1</NbOfTxs>",
        `      <CtrlSum>${escapeXml(amountToString(payment.amount))}</CtrlSum>`,
        "      <InitgPty>",
        `        <Nm>${escapeXml(debtor.name)}</Nm>`,
        "      </InitgPty>",
        "    </GrpHdr>",
        "    <PmtInf>",
        `      <PmtInfId>${escapeXml(instructionId)}</PmtInfId>`,
        "      <PmtMtd>TRF</PmtMtd>",
        "      <PmtTpInf>",
        "        <SvcLvl><Cd>SEPA</Cd></SvcLvl>",
        "      </PmtTpInf>",
        `      <ReqdExctnDt>${escapeXml(executionDate)}</ReqdExctnDt>`,
        "      <Dbtr>",
        `        <Nm>${escapeXml(debtor.name)}</Nm>`,
        "      </Dbtr>",
        "      <DbtrAcct>",
        "        <Id>",
        `          <IBAN>${escapeXml(debtor.iban)}</IBAN>`,
        "        </Id>",
        "      </DbtrAcct>",
        "      <DbtrAgt>",
        "        <FinInstnId>",
        `          <BIC>${escapeXml(debtor.bic)}</BIC>`,
        "        </FinInstnId>",
        "      </DbtrAgt>",
        "      <ChrgBr>SLEV</ChrgBr>",
        "      <CdtTrfTxInf>",
        "        <PmtId>",
        `          <EndToEndId>${escapeXml(endToEndId)}</EndToEndId>`,
        "        </PmtId>",
        "        <Amt>",
        `          <InstdAmt Ccy=\"${escapeXml(currency)}\">${escapeXml(amountToString(payment.amount))}</InstdAmt>`,
        "        </Amt>",
        "        <CdtrAgt>",
        "          <FinInstnId>",
        `            <BIC>${escapeXml(payment.creditor.bic)}</BIC>`,
        "          </FinInstnId>",
        "        </CdtrAgt>",
        "        <Cdtr>",
        `          <Nm>${escapeXml(payment.creditor.name)}</Nm>`,
        "        </Cdtr>",
        "        <CdtrAcct>",
        "          <Id>",
        `            <IBAN>${escapeXml(payment.creditor.iban)}</IBAN>`,
        "          </Id>",
        "        </CdtrAcct>",
        "        <RmtInf>",
        `          <Ustrd>${escapeXml(payment.purpose)}</Ustrd>`,
        "        </RmtInf>",
        "      </CdtTrfTxInf>",
        "    </PmtInf>",
        "  </CstmrCdtTrfInitn>",
        "</Document>",
    ].join("\n");
}

export function parseStandingOrderPain001(message: string) {
    const parsed = Parse.xml(message) as any;
    const document = parsed?.Document?.CstmrCdtTrfInitn;
    if (!document) {
        throw new Error("Invalid pain.001 document for standing order");
    }
    const paymentInfo = Array.isArray(document.PmtInf) ? document.PmtInf[0] : document.PmtInf;
    const creditTransfer = Array.isArray(paymentInfo?.CdtTrfTxInf)
        ? paymentInfo.CdtTrfTxInf[0]
        : paymentInfo?.CdtTrfTxInf;
    const debtor = paymentInfo?.Dbtr || {};
    const debtorAccount = paymentInfo?.DbtrAcct?.Id || {};
    const debtorAgent = paymentInfo?.DbtrAgt?.FinInstnId || {};
    const creditor = creditTransfer?.Cdtr || {};
    const creditorAccount = creditTransfer?.CdtrAcct?.Id || {};
    const creditorAgent = creditTransfer?.CdtrAgt?.FinInstnId || {};
    const amountInfo = creditTransfer?.Amt?.InstdAmt;
    const amount = typeof amountInfo === "object" && amountInfo !== null
        ? Number(amountInfo["#text"])
        : Number(amountInfo);
    const currency = typeof amountInfo === "object" && amountInfo !== null
        ? amountInfo["@_Ccy"]
        : undefined;
    const executionDateRaw = paymentInfo?.ReqdExctnDt;
    const executionDate = executionDateRaw === undefined || executionDateRaw === null
        ? undefined
        : String(executionDateRaw);
    const headerCreationDate = document?.GrpHdr?.CreDtTm;
    const creationDate = headerCreationDate
        ? new Date(headerCreationDate)
        : executionDate
            ? executionDate.includes("-")
                ? new Date(executionDate)
                : Parse.date(executionDate)
            : new Date();

    return {
        amount,
        currency,
        paymentPurpose: creditTransfer?.RmtInf?.Ustrd || "",
        creationDate,
        debitor: {
            name: debtor?.Nm || "",
            iban: debtorAccount?.IBAN || "",
            bic: debtorAgent?.BIC || "",
        },
        creditor: {
            name: creditor?.Nm || "",
            iban: creditorAccount?.IBAN || "",
            bic: creditorAgent?.BIC || "",
        },
    };
}

export function parseStandingOrderPain002(message: string): StandingOrderPain002Status[] {
    const parsed = Parse.xml(message) as any;
    const reports = parsed?.Document?.CstmrPmtStsRpt;
    if (!reports) { return []; }
    const paymentStatus = Array.isArray(reports.OrgnlPmtInfAndSts)
        ? reports.OrgnlPmtInfAndSts
        : reports.OrgnlPmtInfAndSts ? [reports.OrgnlPmtInfAndSts] : [];
    return paymentStatus.map((status: any) => {
        const info = Array.isArray(status.TxInfAndSts) ? status.TxInfAndSts[0] : status.TxInfAndSts;
        const st = info?.TxSts || status?.PmtInfSts || "";
        const reason = info?.StsRsnInf?.AddtlInf
            || status?.StsRsnInf?.AddtlInf
            || status?.PmtInfStsRsnInf?.AddtlInf;
        return {
            status: st,
            additionalInformation: Array.isArray(reason) ? reason.join(" ") : reason,
        } as StandingOrderPain002Status;
    });
}
