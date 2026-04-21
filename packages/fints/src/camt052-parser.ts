import { Statement, Transaction, StructuredDescription } from "./types";

function getTag(xml: string, tag: string): string | undefined {
    const match = xml.match(new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[^:>]+:)?${tag}>`, "i"));
    return match?.[1]?.trim();
}

function getAllTags(xml: string, tag: string): string[] {
    const results: string[] = [];
    const regex = new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[^:>]+:)?${tag}>`, "gi");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(xml)) !== null) {
        results.push(match[1].trim());
    }
    return results;
}

function getAttr(xml: string, tag: string, attr: string): string | undefined {
    const match = xml.match(new RegExp(`<(?:[^:>]+:)?${tag}[^>]*\\s${attr}="([^"]*)"`, "i"));
    return match?.[1];
}

function parseDate(dateStr: string | undefined): Date {
    if (!dateStr) return new Date(0);
    return new Date(dateStr.trim());
}

/**
 * Parse CAMT.052 XML into Statement objects compatible with the mt940-js Statement interface.
 */
export function parseCamt052(xml: string): Statement[] {
    const reports = getAllTags(xml, "Rpt");
    if (reports.length === 0) return [];

    return reports.map((rpt) => {
        const ibanTag = getTag(rpt, "IBAN");
        const accountIdentification = ibanTag || getTag(rpt, "Id") || "";

        const openingBalanceXml = getAllTags(rpt, "Bal").find(
            (b) => getTag(b, "Tp") && /OPBD|PRCD/.test(getTag(b, "Cd") || ""),
        );
        const closingBalanceXml = getAllTags(rpt, "Bal").find(
            (b) => getTag(b, "Tp") && /CLBD|CLAV/.test(getTag(b, "Cd") || ""),
        );

        const openingBalance = openingBalanceXml
            ? {
                  date: parseDate(getTag(openingBalanceXml, "Dt")),
                  currency: getAttr(openingBalanceXml, "Amt", "Ccy") || "EUR",
                  value: parseFloat(getTag(openingBalanceXml, "Amt") || "0"),
              }
            : undefined;

        const closingBalance = closingBalanceXml
            ? {
                  date: parseDate(getTag(closingBalanceXml, "Dt")),
                  currency: getAttr(closingBalanceXml, "Amt", "Ccy") || "EUR",
                  value: parseFloat(getTag(closingBalanceXml, "Amt") || "0"),
              }
            : undefined;

        const ntryElements = getAllTags(rpt, "Ntry");
        const transactions: Transaction[] = ntryElements.map((ntry) => {
            const amtStr = getTag(ntry, "Amt");
            const currency = getAttr(ntry, "Amt", "Ccy") || "EUR";
            const amount = parseFloat(amtStr || "0");
            const cdtDbtInd = getTag(ntry, "CdtDbtInd") || "";
            const isCredit = cdtDbtInd.trim().toUpperCase() === "CRDT";
            const isReversal = (getTag(ntry, "RvslInd") || "").trim().toLowerCase() === "true";

            const bookgDt = getTag(ntry, "BookgDt");
            const valDt = getTag(ntry, "ValDt");
            const date = parseDate(getTag(bookgDt || "", "Dt") || bookgDt);
            const valueDate = parseDate(getTag(valDt || "", "Dt") || valDt);

            const acctSvcrRef = getTag(ntry, "AcctSvcrRef") || "";
            const txDtls = getTag(ntry, "TxDtls") || ntry;

            const debtorName = getTag(getTag(txDtls, "Dbtr") || "", "Nm");
            const creditorName = getTag(getTag(txDtls, "Cdtr") || "", "Nm");
            const name = (isCredit ? debtorName : creditorName) || "";

            const dbtrIban = getTag(getTag(txDtls, "DbtrAcct") || "", "IBAN");
            const cdtrIban = getTag(getTag(txDtls, "CdtrAcct") || "", "IBAN");
            const counterpartyIban = (isCredit ? dbtrIban : cdtrIban) || "";

            const dbtrBic = getTag(getTag(txDtls, "DbtrAgt") || "", "BICFI") || getTag(getTag(txDtls, "DbtrAgt") || "", "BIC");
            const cdtrBic = getTag(getTag(txDtls, "CdtrAgt") || "", "BICFI") || getTag(getTag(txDtls, "CdtrAgt") || "", "BIC");
            const counterpartyBic = (isCredit ? dbtrBic : cdtrBic) || "";

            const ustrd = getAllTags(txDtls, "Ustrd").join(" ");
            const addtlNtryInf = getTag(ntry, "AddtlNtryInf") || getTag(ntry, "AddtlTxInf") || "";
            const description = ustrd || addtlNtryInf;

            const endToEndId = getTag(txDtls, "EndToEndId") || "";
            const mandateId = getTag(txDtls, "MndtId") || "";
            const creditorId = getTag(txDtls, "CdtrId") || "";

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
            openingBalance,
            closingBalance,
            transactions,
        } as unknown as Statement;
    });
}
