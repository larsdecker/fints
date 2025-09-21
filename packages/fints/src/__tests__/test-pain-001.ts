import { buildPain001Message, resolvePainDescriptor } from "../pain-builder";
import { CreditTransferParameters } from "../types";
import { Parse } from "../parse";

const debtor = {
    name: "Alice Example",
    iban: "DE02123456780123456789",
    bic: "DEUTDEFFXXX",
};
const creditor = {
    name: "Bob Receiver",
    iban: "DE44123456781234567890",
    bic: "BANKDEBBXXX",
};

describe("pain.001 generation", () => {
    it("creates a valid document for a single transfer", () => {
        const params: CreditTransferParameters = {
            debtor,
            debtorName: debtor.name,
            transactions: [
                {
                    creditor,
                    amount: 12.34,
                    remittanceInformation: "Invoice 2024/07",
                    endToEndId: "END2END-123",
                },
            ],
        };
        const message = buildPain001Message(params);
        expect(message.schema).toBe("pain.001.003.03");
        const parsed: any = Parse.xml(message.xml);
        const initiation = parsed.Document.CstmrCdtTrfInitn;
        expect(String(initiation.GrpHdr.MsgId)).toBe(message.messageId);
        expect(String(initiation.PmtInf.PmtInfId)).toBe(message.paymentInformationId);
        expect(message.xml).toContain("InstdAmt Ccy=\"EUR\"");
        expect(message.xml).toContain("<Ustrd>Invoice 2024/07</Ustrd>");
    });

    it("resolves schema descriptor with suffixes", () => {
        const descriptor = resolvePainDescriptor([
            "urn:iso:std:iso:20022:tech:xsd:pain.001.003.03_GBIC_1",
            "urn:iso:std:iso:20022:tech:xsd:pain.001.001.03",
        ], "pain.001.003.03");
        expect(descriptor).toBe("urn:iso:std:iso:20022:tech:xsd:pain.001.003.03_GBIC_1");
    });
});
