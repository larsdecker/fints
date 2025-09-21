import { XMLBuilder } from "fast-xml-parser";

import {
    CreditTransferTransactionInformationSCT,
    Pain001Document,
    Pain001Message,
    PaymentInstructionInformationSCT,
} from "./pain-formats";
import { CreditTransferParameters, CreditTransferTransaction, Pain001Schema } from "./types";

const DEFAULT_SCHEMA: Pain001Schema = "pain.001.003.03";
const IMMEDIATE_EXECUTION_DATE = "1999-01-01";

export function buildPain001Message(initiation: CreditTransferParameters): Pain001Message {
    if (!initiation.transactions || initiation.transactions.length === 0) {
        throw new Error("At least one transaction is required to build a pain.001 message.");
    }
    const schema = initiation.schema ?? DEFAULT_SCHEMA;
    const creationDate = initiation.creationDateTime ?? new Date();
    const messageId = initiation.messageId ?? Math.floor(creationDate.getTime() / 1000).toString();
    const paymentInformationId = initiation.paymentInformationId ?? messageId;
    const executionDate = initiation.executionDate ?? new Date(IMMEDIATE_EXECUTION_DATE);
    const controlSum = initiation.transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const numberOfTransactions = initiation.transactions.length;
    const debtorBic = initiation.debtor.bic;
    if (!debtorBic) {
        throw new Error("Debtor BIC is required for pain.001 messages.");
    }

    const transactions = initiation.transactions.map((tx: CreditTransferTransaction) => {
        const creditorBic = tx.creditor.bic;
        if (!creditorBic) {
            throw new Error("Creditor BIC is required for pain.001 transactions.");
        }
        const transaction: CreditTransferTransactionInformationSCT = {
            PmtId: { EndToEndId: tx.endToEndId && tx.endToEndId.length > 0 ? tx.endToEndId : "NOTPROVIDED" },
            Amt: {
                InstdAmt: {
                    "@_Ccy": tx.currency ?? "EUR",
                    "#text": formatAmount(tx.amount),
                },
            },
            Cdtr: { Nm: tx.creditor.name },
            CdtrAcct: { Id: { IBAN: tx.creditor.iban } },
        };
        if (creditorBic) {
            transaction.CdtrAgt = { FinInstnId: { BIC: creditorBic } };
        }
        if (tx.remittanceInformation) {
            transaction.RmtInf = { Ustrd: tx.remittanceInformation };
        }
        return transaction;
    });

    const paymentInfo: PaymentInstructionInformationSCT = {
        PmtInfId: paymentInformationId,
        PmtMtd: "TRF",
        NbOfTxs: numberOfTransactions.toString(),
        CtrlSum: Number(controlSum.toFixed(2)),
        PmtTpInf: { SvcLvl: { Cd: "SEPA" } },
        ReqdExctnDt: formatDate(executionDate),
        Dbtr: { Nm: initiation.debtorName },
        DbtrAcct: { Id: { IBAN: initiation.debtor.iban } },
        DbtrAgt: { FinInstnId: { BIC: debtorBic } },
        ChrgBr: initiation.chargeBearer ?? "SLEV",
        CdtTrfTxInf: transactions.length === 1 ? transactions[0] : transactions,
    };

    const painDocument: Pain001Document = {
        Document: {
            CstmrCdtTrfInitn: {
                GrpHdr: {
                    MsgId: messageId,
                    CreDtTm: creationDate.toISOString(),
                    NbOfTxs: numberOfTransactions.toString(),
                    CtrlSum: Number(controlSum.toFixed(2)),
                    InitgPty: { Nm: initiation.initiatingPartyName ?? initiation.debtorName },
                },
                PmtInf: paymentInfo,
            },
        },
    };

    const builder = new XMLBuilder({
        attributeNamePrefix: "@_",
        ignoreAttributes: false,
        suppressEmptyNode: true,
    });

    const xmlBody = builder.build({
        Document: {
            "@_xmlns": `urn:iso:std:iso:20022:tech:xsd:${schema}`,
            "@_xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
            "@_xsi:schemaLocation": `urn:iso:std:iso:20022:tech:xsd:${schema} ${schema}.xsd`,
            CstmrCdtTrfInitn: painDocument.Document.CstmrCdtTrfInitn,
        },
    });

    return {
        xml: `<?xml version="1.0" encoding="UTF-8"?>${xmlBody}`,
        schema,
        messageId,
        paymentInformationId,
        numberOfTransactions,
        controlSum: Number(controlSum.toFixed(2)),
    };
}

export function resolvePainDescriptor(availableFormats: string[], schema: Pain001Schema): string {
    const target = `urn:iso:std:iso:20022:tech:xsd:${schema}`;
    const match = availableFormats.find((format) => format.startsWith(target));
    if (!match) {
        throw new Error(`None of the provided pain formats support the schema ${schema}.`);
    }
    return match;
}

function formatAmount(amount: number) {
    return amount.toFixed(2);
}

function formatDate(date: Date) {
    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
    const day = `${date.getUTCDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
}
