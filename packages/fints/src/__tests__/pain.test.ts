import { buildStandingOrderPain001 } from "../pain-formats";
import { buildPain008, selectPain008Descriptor } from "../pain";
import { DirectDebitRequest, SEPAAccount, StandingOrderPayment, StandingOrderSchedule } from "../types";

describe("pain helpers", () => {
    test("selectPain008Descriptor prefers latest version", () => {
        const formats = [
            "sepade?:xsd?:pain.008.002.02.xsd",
            "urn?:iso?:std?:iso?:20022?:tech?:xsd?:pain.008.003.01",
            "sepade.pain.008.003.02.xsd",
        ];
        expect(selectPain008Descriptor(formats)).toBe("sepade.pain.008.003.02.xsd");
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

    test("buildStandingOrderPain001 formats execution date with hyphen separators", () => {
        const account: SEPAAccount = {
            iban: "DE27100777770209299700",
            bic: "DEUTDEFF500",
            accountNumber: "0123456789",
            blz: "10050000",
            accountOwnerName: "Max Mustermann",
        };
        const payment: StandingOrderPayment = {
            amount: 123.45,
            purpose: "Monthly rent",
            creditor: {
                name: "John Doe",
                iban: "DE58140369180198038800",
                bic: "DEU1GFAS800",
            },
        };
        const schedule: StandingOrderSchedule = {
            startDate: new Date("2024-04-15T00:00:00Z"),
            timeUnit: "M",
            interval: 1,
        };

        const xml = buildStandingOrderPain001({ account, payment, schedule });

        expect(xml).toContain("<ReqdExctnDt>2024-04-15</ReqdExctnDt>");
        expect(xml).toContain("<CreDtTm>2024-04-15T00:00:00Z</CreDtTm>");
    });
});
