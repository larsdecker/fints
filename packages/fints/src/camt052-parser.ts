import { Statement, Transaction, StructuredDescription } from "./types";
import { XMLParser } from "fast-xml-parser";

const parserOptions = {
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
    removeNSPrefix: true,
    isArray: (name: string) => ["Rpt", "Ntry", "Bal", "Ustrd", "TxDtls"].includes(name),
};

function getVal(obj: unknown, path: string): unknown {
    const parts = path.split(".");
    let cur: unknown = obj;
    for (const p of parts) {
        if (cur == null || typeof cur !== "object") return undefined;
        cur = (cur as Record<string, unknown>)[p];
    }
    return cur;
}

function getStr(obj: unknown, path: string): string | undefined {
    const v = getVal(obj, path);
    return v == null ? undefined : String(v);
}

function parseDate(dateStr: string | undefined): Date {
    if (!dateStr) return new Date(0);
    const d = new Date(dateStr.trim());
    return isNaN(d.getTime()) ? new Date(0) : d;
}

function parseAmount(amtNode: unknown): { value: number; currency: string } {
    if (amtNode == null) return { value: 0, currency: "EUR" };
    if (typeof amtNode === "object") {
        const obj = amtNode as Record<string, unknown>;
        return {
            value: parseFloat(String(obj["#text"] ?? 0)) || 0,
            currency: String(obj["@_Ccy"] ?? "EUR"),
        };
    }
    return { value: parseFloat(String(amtNode)) || 0, currency: "EUR" };
}

function ensureArray<T>(value: T | T[] | undefined | null): T[] {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
}

export function parseCamt052(xml: string): Statement[] {
    if (!xml?.trim()) return [];

    const parser = new XMLParser(parserOptions);
    const parsed = parser.parse(xml);
    const doc = parsed.Document || parsed;
    const report = doc.BkToCstmrAcctRpt || doc;
    const reports: Record<string, unknown>[] = ensureArray(report.Rpt);

    if (reports.length === 0) return [];

    return reports.map((rpt) => {
        const accountIdentification = getStr(rpt, "Acct.Id.IBAN") || getStr(rpt, "Acct.Id.Id") || "";

        const balances: Record<string, unknown>[] = ensureArray(rpt.Bal as Record<string, unknown>[]);
        const openingBal = balances.find((b) => /OPBD|PRCD/.test(getStr(b, "Tp.CdOrPrtry.Cd") || ""));
        const closingBal = balances.find((b) => /CLBD|CLAV/.test(getStr(b, "Tp.CdOrPrtry.Cd") || ""));

        const toBalance = (bal: Record<string, unknown> | undefined) => {
            if (!bal) return undefined;
            const { value, currency } = parseAmount(getVal(bal, "Amt"));
            const dateStr = getStr(bal, "Dt.Dt") || getStr(bal, "Dt.DtTm");
            return { date: parseDate(dateStr), currency, value };
        };

        const entries: Record<string, unknown>[] = ensureArray(rpt.Ntry as Record<string, unknown>[]);

        const transactions: Transaction[] = entries.map((ntry) => {
            const { value: amount, currency } = parseAmount(getVal(ntry, "Amt"));
            const cdtDbtInd = (getStr(ntry, "CdtDbtInd") || "").trim().toUpperCase();
            const isCredit = cdtDbtInd === "CRDT";
            const isReversal = (getStr(ntry, "RvslInd") || "").trim().toLowerCase() === "true";

            const date = parseDate(getStr(ntry, "BookgDt.Dt") || getStr(ntry, "BookgDt.DtTm"));
            const valueDate = parseDate(getStr(ntry, "ValDt.Dt") || getStr(ntry, "ValDt.DtTm"));
            const acctSvcrRef = getStr(ntry, "AcctSvcrRef") || "";

            const ntryDtls = getVal(ntry, "NtryDtls") as Record<string, unknown> | undefined;
            const txDtlsList: Record<string, unknown>[] = ntryDtls
                ? ensureArray(ntryDtls.TxDtls as Record<string, unknown>[])
                : [];
            const txDtls = txDtlsList[0] as Record<string, unknown> | undefined;

            const debtorName =
                getStr(txDtls, "RltdPties.Dbtr.Pty.Nm") ||
                getStr(txDtls, "RltdPties.Dbtr.Nm") ||
                getStr(txDtls, "Dbtr.Nm");
            const creditorName =
                getStr(txDtls, "RltdPties.Cdtr.Pty.Nm") ||
                getStr(txDtls, "RltdPties.Cdtr.Nm") ||
                getStr(txDtls, "Cdtr.Nm");
            const name = (isCredit ? debtorName : creditorName) || "";

            const dbtrIban =
                getStr(txDtls, "RltdPties.DbtrAcct.Id.IBAN") || getStr(txDtls, "DbtrAcct.Id.IBAN");
            const cdtrIban =
                getStr(txDtls, "RltdPties.CdtrAcct.Id.IBAN") || getStr(txDtls, "CdtrAcct.Id.IBAN");
            const counterpartyIban = (isCredit ? dbtrIban : cdtrIban) || "";

            const dbtrBic =
                getStr(txDtls, "RltdAgts.DbtrAgt.FinInstnId.BICFI") ||
                getStr(txDtls, "RltdAgts.DbtrAgt.FinInstnId.BIC") ||
                getStr(txDtls, "DbtrAgt.FinInstnId.BICFI") ||
                getStr(txDtls, "DbtrAgt.FinInstnId.BIC");
            const cdtrBic =
                getStr(txDtls, "RltdAgts.CdtrAgt.FinInstnId.BICFI") ||
                getStr(txDtls, "RltdAgts.CdtrAgt.FinInstnId.BIC") ||
                getStr(txDtls, "CdtrAgt.FinInstnId.BICFI") ||
                getStr(txDtls, "CdtrAgt.FinInstnId.BIC");
            const counterpartyBic = (isCredit ? dbtrBic : cdtrBic) || "";

            const rmtInf = getVal(txDtls, "RmtInf") as Record<string, unknown> | undefined;
            const ustrdArr: string[] = rmtInf ? ensureArray(rmtInf.Ustrd as string[]).map(String) : [];
            const ustrd = ustrdArr.join(" ");
            const addtlNtryInf = getStr(ntry, "AddtlNtryInf") || getStr(ntry, "AddtlTxInf") || "";
            const description = ustrd || addtlNtryInf;

            const endToEndId = getStr(txDtls, "Refs.EndToEndId") || "";
            const mandateId = getStr(txDtls, "Refs.MndtId") || "";
            const creditorId =
                getStr(txDtls, "RltdPties.Cdtr.Pty.Id.PrvtId.Othr.Id") ||
                getStr(txDtls, "RltdPties.Cdtr.Id.PrvtId.Othr.Id") ||
                "";

            const descriptionStructured: Partial<StructuredDescription> = {
                name,
                text: description,
                iban: counterpartyIban,
                bic: counterpartyBic,
                primaNota: "",
                reference: {
                    raw: description,
                    endToEndRef: endToEndId || undefined,
                    mandateRef: mandateId || undefined,
                    creditorId: creditorId || undefined,
                },
            };

            return {
                id: acctSvcrRef,
                date,
                valueDate,
                amount,
                isCredit,
                isExpense: !isCredit,
                isReversal,
                currency,
                name,
                description,
                bankReference: description,
                descriptionStructured,
                details: [name, description, endToEndId, mandateId].filter(Boolean).join("\n"),
            } as unknown as Transaction;
        });

        return {
            accountIdentification,
            openingBalance: toBalance(openingBal),
            closingBalance: toBalance(closingBal),
            transactions,
        } as unknown as Statement;
    });
}
