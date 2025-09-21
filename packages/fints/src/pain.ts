import { format } from "date-fns";
import { DirectDebitRequest, DirectDebitSubmission, SEPAAccount } from "./types";
import { unescapeFinTS } from "./utils";

export interface Pain008Message {
    xml: string;
    messageId: string;
    paymentInformationId: string;
    endToEndId: string;
    namespace: string;
}

const DEFAULT_DIRECT_DEBIT_SEQUENCE = "OOFF";
const DEFAULT_LOCAL_INSTRUMENT = "CORE";
const DEFAULT_CURRENCY = "EUR";

function escapeXml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function formatDate(date: Date): string {
    return format(date, "yyyy-MM-dd");
}

function formatDateTime(date: Date): string {
    return format(date, "yyyy-MM-dd'T'HH:mm:ss");
}

function formatAmount(amount: number): string {
    return amount.toFixed(2);
}

function ensurePositiveAmount(amount: number) {
    if (!(amount > 0)) {
        throw new Error("Direct debit amount must be greater than zero.");
    }
}

function ensureDate(value: Date, description: string) {
    if (!(value instanceof Date) || isNaN(value.getTime())) {
        throw new Error(`${description} must be a valid date.`);
    }
}

function ensureText(value: string, description: string) {
    if (!value || value.trim().length === 0) {
        throw new Error(`${description} must be provided.`);
    }
}

function namespaceFromDescriptor(descriptor: string): string {
    const unescaped = unescapeFinTS(descriptor);
    const versionMatch = unescaped.match(/pain\.008\.\d{3}\.\d{2}/);
    if (versionMatch) {
        return `urn:iso:std:iso:20022:tech:xsd:${versionMatch[0]}`;
    }
    return unescaped.replace(/\.xsd$/i, "");
}

export function selectPain008Descriptor(painFormats: string[]): string {
    const preferredVersions = [
        "pain.008.003.02",
        "pain.008.003.01",
        "pain.008.002.02",
        "pain.008.001.02",
    ];
    for (const version of preferredVersions) {
        const descriptor = painFormats.find(candidate => candidate.includes(version));
        if (descriptor) { return descriptor; }
    }
    const fallback = painFormats.find(candidate => candidate.includes("pain.008"));
    if (fallback) { return fallback; }
    throw new Error("Bank does not advertise support for pain.008 direct debit messages.");
}

export function buildPain008(
    request: DirectDebitRequest,
    account: SEPAAccount,
    descriptor: string,
): Pain008Message {
    ensureText(account.iban, "Creditor IBAN");
    ensureText(account.bic, "Creditor BIC");
    ensureText(request.creditorName, "Creditor name");
    ensureText(request.creditorId, "Creditor identifier");
    ensureText(request.debtor?.name, "Debtor name");
    ensureText(request.debtor?.iban, "Debtor IBAN");
    ensureText(request.mandateId, "Mandate identifier");
    ensurePositiveAmount(request.amount);
    ensureDate(request.mandateSignatureDate, "Mandate signature date");
    ensureDate(request.requestedCollectionDate, "Requested collection date");

    const createdAt = request.creationDateTime ? new Date(request.creationDateTime) : new Date();
    const messageId = request.messageId || `DD-${format(createdAt, "yyyyMMddHHmmssSSS")}`;
    const paymentInformationId = request.paymentInformationId || messageId;
    const endToEndId = request.endToEndId || "NOTPROVIDED";
    const currency = request.currency || DEFAULT_CURRENCY;
    const sequenceType = request.sequenceType || DEFAULT_DIRECT_DEBIT_SEQUENCE;
    const localInstrument = request.localInstrument || DEFAULT_LOCAL_INSTRUMENT;
    const batchBooking = request.batchBooking === true;
    const namespace = namespaceFromDescriptor(descriptor);
    const debtorBic = request.debtor.bic;
    const amount = formatAmount(request.amount);
    const creditorName = request.creditorName.trim();
    const debtorName = request.debtor.name.trim();

    const xmlParts = [
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
        `<Document xmlns=\"${escapeXml(namespace)}\">`,
        "  <CstmrDrctDbtInitn>",
        "    <GrpHdr>",
        `      <MsgId>${escapeXml(messageId)}</MsgId>`,
        `      <CreDtTm>${formatDateTime(createdAt)}</CreDtTm>`,
        "      <NbOfTxs>1</NbOfTxs>",
        `      <CtrlSum>${amount}</CtrlSum>`,
        "      <InitgPty>",
        `        <Nm>${escapeXml(creditorName)}</Nm>`,
        "      </InitgPty>",
        "    </GrpHdr>",
        "    <PmtInf>",
        `      <PmtInfId>${escapeXml(paymentInformationId)}</PmtInfId>`,
        "      <PmtMtd>DD</PmtMtd>",
        `      <BtchBookg>${batchBooking ? "true" : "false"}</BtchBookg>`,
        "      <NbOfTxs>1</NbOfTxs>",
        `      <CtrlSum>${amount}</CtrlSum>`,
        "      <PmtTpInf>",
        "        <SvcLvl>",
        "          <Cd>SEPA</Cd>",
        "        </SvcLvl>",
        "        <LclInstrm>",
        `          <Cd>${escapeXml(localInstrument)}</Cd>`,
        "        </LclInstrm>",
        `        <SeqTp>${escapeXml(sequenceType)}</SeqTp>`,
        "      </PmtTpInf>",
        `      <ReqdColltnDt>${formatDate(request.requestedCollectionDate)}</ReqdColltnDt>`,
        "      <Cdtr>",
        `        <Nm>${escapeXml(creditorName)}</Nm>`,
        "      </Cdtr>",
        "      <CdtrAcct>",
        "        <Id>",
        `          <IBAN>${escapeXml(account.iban)}</IBAN>`,
        "        </Id>",
        "      </CdtrAcct>",
        "      <CdtrAgt>",
        "        <FinInstnId>",
        `          <BIC>${escapeXml(account.bic)}</BIC>`,
        "        </FinInstnId>",
        "      </CdtrAgt>",
        "      <ChrgBr>SLEV</ChrgBr>",
        "      <CdtrSchmeId>",
        "        <Id>",
        "          <PrvtId>",
        "            <Othr>",
        `              <Id>${escapeXml(request.creditorId)}</Id>`,
        "              <SchmeNm>",
        "                <Prtry>SEPA</Prtry>",
        "              </SchmeNm>",
        "            </Othr>",
        "          </PrvtId>",
        "        </Id>",
        "      </CdtrSchmeId>",
        "      <DrctDbtTxInf>",
        "        <PmtId>",
        `          <EndToEndId>${escapeXml(endToEndId)}</EndToEndId>`,
        "        </PmtId>",
        `        <InstdAmt Ccy=\"${escapeXml(currency)}\">${amount}</InstdAmt>`,
        "        <DrctDbtTx>",
        "          <MndtRltdInf>",
        `            <MndtId>${escapeXml(request.mandateId)}</MndtId>`,
        `            <DtOfSgntr>${formatDate(request.mandateSignatureDate)}</DtOfSgntr>`,
        "          </MndtRltdInf>",
        "        </DrctDbtTx>",
    ];

    if (debtorBic) {
        xmlParts.push(
            "        <DbtrAgt>",
            "          <FinInstnId>",
            `            <BIC>${escapeXml(debtorBic)}</BIC>`,
            "          </FinInstnId>",
            "        </DbtrAgt>",
        );
    }

    xmlParts.push(
        "        <Dbtr>",
        `          <Nm>${escapeXml(debtorName)}</Nm>`,
        "        </Dbtr>",
        "        <DbtrAcct>",
        "          <Id>",
        `            <IBAN>${escapeXml(request.debtor.iban)}</IBAN>`,
        "          </Id>",
        "        </DbtrAcct>",
    );

    if (request.purposeCode) {
        xmlParts.push(
            "        <Purp>",
            `          <Cd>${escapeXml(request.purposeCode)}</Cd>`,
            "        </Purp>",
        );
    }

    if (request.remittanceInformation) {
        xmlParts.push(
            "        <RmtInf>",
            `          <Ustrd>${escapeXml(request.remittanceInformation)}</Ustrd>`,
            "        </RmtInf>",
        );
    }

    xmlParts.push(
        "      </DrctDbtTxInf>",
        "    </PmtInf>",
        "  </CstmrDrctDbtInitn>",
        "</Document>",
    );

    const xml = xmlParts.join(" ");

    return {
        xml,
        messageId,
        paymentInformationId,
        endToEndId,
        namespace,
    };
}

export function buildDirectDebitSubmission(
    request: DirectDebitRequest,
    account: SEPAAccount,
    descriptor: string,
): DirectDebitSubmission {
    const { xml, messageId, paymentInformationId, endToEndId } = buildPain008(request, account, descriptor);
    return {
        taskId: undefined,
        messageId,
        paymentInformationId,
        endToEndId,
        painDescriptor: descriptor,
        xml,
    };
}
