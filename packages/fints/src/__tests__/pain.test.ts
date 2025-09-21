import { buildPain001, buildPain008, selectPain001Descriptor, selectPain008Descriptor } from "../pain";
import { CreditTransferRequest, DirectDebitRequest, SEPAAccount } from "../types";

describe("pain helpers", () => {
    test("selectPain008Descriptor prefers latest version", () => {
        const formats = [
            "sepade?:xsd?:pain.008.002.02.xsd",
            "urn?:iso?:std?:iso?:20022?:tech?:xsd?:pain.008.003.01",
            "sepade.pain.008.003.02.xsd",
        ];
        expect(selectPain008Descriptor(formats)).toBe("sepade.pain.008.003.02.xsd");
    });

    test("selectPain001Descriptor prefers latest version", () => {
        const formats = [
            "sepade?:xsd?:pain.001.001.02.xsd",
            "urn?:iso?:std?:iso?:20022?:tech?:xsd?:pain.001.001.03",
            "sepade.pain.001.003.03.xsd",
        ];
        expect(selectPain001Descriptor(formats)).toBe("sepade.pain.001.003.03.xsd");
    });

    test("buildPain008 creates xml payload", () => {
        const account: SEPAAccount = {
            iban: "DE44500105175407324931",
            bic: "INGDDEFFXXX",
            accountNumber: "1234567",
            blz: "50010517",
        };
        const request: DirectDebitRequest = {
            creditorName: "ACME GmbH",
            creditorId: "DE98ZZZ09999999999",
            debtor: {
                name: "John Doe",
                iban: "DE02120300000000202051",
                bic: "COBADEFFXXX",
            },
            amount: 99.5,
            currency: "EUR",
            endToEndId: "E2E-1",
            mandateId: "MANDATE-1",
            mandateSignatureDate: new Date("2021-01-02"),
            requestedCollectionDate: new Date("2021-03-04"),
            remittanceInformation: "Invoice 0815",
            sequenceType: "OOFF",
            localInstrument: "CORE",
            messageId: "MSG-1",
            paymentInformationId: "PMT-1",
        };
        const descriptor = "urn?:iso?:std?:iso?:20022?:tech?:xsd?:pain.008.003.02";
        const { xml, namespace } = buildPain008(request, account, descriptor);
        expect(namespace).toBe("urn:iso:std:iso:20022:tech:xsd:pain.008.003.02");
        expect(xml).toContain("<MsgId>MSG-1</MsgId>");
        expect(xml).toContain("<PmtInfId>PMT-1</PmtInfId>");
        expect(xml).toContain("<InstdAmt Ccy=\"EUR\">99.50</InstdAmt>");
        expect(xml).toContain("<IBAN>DE44500105175407324931</IBAN>");
        expect(xml).toContain("<IBAN>DE02120300000000202051</IBAN>");
        expect(xml).toContain("<RmtInf><Ustrd>Invoice 0815</Ustrd></RmtInf>");
    });

    test("buildPain001 creates xml payload", () => {
        const account: SEPAAccount = {
            iban: "DE02120300000000202051",
            bic: "COBADEFFXXX",
            accountNumber: "102030",
            blz: "12030000",
        };
        const request: CreditTransferRequest = {
            debtorName: "John Doe",
            creditor: {
                name: "ACME GmbH",
                iban: "DE44500105175407324931",
                bic: "INGDDEFFXXX",
            },
            amount: 120.45,
            currency: "EUR",
            endToEndId: "E2E-42",
            remittanceInformation: "Consulting",
            purposeCode: "GDDS",
            executionDate: new Date("2021-05-06"),
            batchBooking: false,
            messageId: "MSG-42",
            paymentInformationId: "PMT-42",
        };
        const descriptor = "urn?:iso?:std?:iso?:20022?:tech?:xsd?:pain.001.003.03";
        const { xml, namespace } = buildPain001(request, account, descriptor);
        expect(namespace).toBe("urn:iso:std:iso:20022:tech:xsd:pain.001.003.03");
        expect(xml).toContain("<MsgId>MSG-42</MsgId>");
        expect(xml).toContain("<PmtInfId>PMT-42</PmtInfId>");
        expect(xml).toContain("<InstdAmt Ccy=\"EUR\">120.45</InstdAmt>");
        expect(xml).toContain("<IBAN>DE02120300000000202051</IBAN>");
        expect(xml).toContain("<IBAN>DE44500105175407324931</IBAN>");
        expect(xml).toContain("<RmtInf><Ustrd>Consulting</Ustrd></RmtInf>");
        expect(xml).toContain("<Purp><Cd>GDDS</Cd></Purp>");
    });
});
