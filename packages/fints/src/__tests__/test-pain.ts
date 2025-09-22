import {
    buildCreditTransferSubmission,
    buildDirectDebitSubmission,
    buildPain001,
    buildPain008,
    selectPain001Descriptor,
    selectPain008Descriptor,
} from "../pain";
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

    test("selectPain008Descriptor falls back to generic descriptor", () => {
        const formats = [
            "urn?:iso?:std?:iso?:20022?:tech?:xsd?:pain.008.xsd",
            "random-format",
        ];
        expect(selectPain008Descriptor(formats)).toBe("urn?:iso?:std?:iso?:20022?:tech?:xsd?:pain.008.xsd");
    });

    test("selectPain008Descriptor throws when no supported descriptor is advertised", () => {
        expect(() => selectPain008Descriptor(["pain.009.000.01"])).toThrow(
            "Bank does not advertise support for pain.008 direct debit messages.",
        );
        expect(() => selectPain008Descriptor([])).toThrow(
            "Bank does not advertise support for pain.008 direct debit messages.",
        );
    });

    test("selectPain001Descriptor prefers latest version", () => {
        const formats = [
            "sepade?:xsd?:pain.001.001.02.xsd",
            "urn?:iso?:std?:iso?:20022?:tech?:xsd?:pain.001.001.03",
            "sepade.pain.001.003.03.xsd",
        ];
        expect(selectPain001Descriptor(formats)).toBe("sepade.pain.001.003.03.xsd");
    });

    test("selectPain001Descriptor falls back to generic descriptor", () => {
        const formats = [
            "urn?:iso?:std?:iso?:20022?:tech?:xsd?:pain.001.xsd",
            "unrelated",
        ];
        expect(selectPain001Descriptor(formats)).toBe("urn?:iso?:std?:iso?:20022?:tech?:xsd?:pain.001.xsd");
    });

    test("selectPain001Descriptor throws when no supported descriptor is advertised", () => {
        expect(() => selectPain001Descriptor(["pain.002.000.01"])).toThrow(
            "Bank does not advertise support for pain.001 credit transfer messages.",
        );
        expect(() => selectPain001Descriptor([])).toThrow(
            "Bank does not advertise support for pain.001 credit transfer messages.",
        );
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
        expect(xml).toContain("<RmtInf>");
        expect(xml).toContain("<Ustrd>Invoice 0815</Ustrd>");
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
        expect(xml).toContain("<RmtInf>");
        expect(xml).toContain("<Ustrd>Consulting</Ustrd>");
        expect(xml).toContain("<Purp>");
        expect(xml).toContain("<Cd>GDDS</Cd>");
    });

    test("buildPain008 applies defaults and escapes xml content", () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2020-02-02T03:04:05.006Z"));
        try {
            const account: SEPAAccount = {
                iban: "DE00123456781234567890",
                bic: "BANKDEFFXXX",
                accountNumber: "9999999",
                blz: "10000000",
            };
            const request: DirectDebitRequest = {
                creditorName: "  ACME & Co <>\"'  ",
                creditorId: "Creditor & 1",
                debtor: {
                    name: "  Doe & Partners  ",
                    iban: "DE10987654321098765432",
                },
                amount: 12.34,
                mandateId: "MAND-001 & MORE",
                mandateSignatureDate: new Date("2020-01-02T00:00:00Z"),
                requestedCollectionDate: new Date("2020-02-05T00:00:00Z"),
            };
            const descriptor = "urn?:iso?:std?:iso?:20022?:tech?:xsd?:pain.008.xsd";
            const result = buildPain008(request, account, descriptor);
            expect(result.messageId).toBe("DD-20200202030405006");
            expect(result.paymentInformationId).toBe("DD-20200202030405006");
            expect(result.endToEndId).toBe("NOTPROVIDED");
            expect(result.namespace).toBe("urn:iso:std:iso:20022:tech:xsd:pain.008");

            const xml = result.xml;
            expect(xml).toContain("<CreDtTm>2020-02-02T03:04:05</CreDtTm>");
            expect(xml).toContain("<BtchBookg>false</BtchBookg>");
            expect(xml).toContain("<SeqTp>OOFF</SeqTp>");
            expect(xml).toContain("<Cd>CORE</Cd>");
            expect(xml).toContain("<EndToEndId>NOTPROVIDED</EndToEndId>");
            expect(xml).toContain("<ReqdColltnDt>2020-02-05</ReqdColltnDt>");
            expect(xml).not.toContain("<DbtrAgt>");
            expect(xml).not.toContain("<RmtInf>");
            expect(xml).not.toContain("<Purp>");
            expect(xml).toContain("<Nm>ACME &amp; Co &lt;&gt;&quot;&apos;</Nm>");
            expect(xml).toContain("<Nm>Doe &amp; Partners</Nm>");
            expect(xml).toContain("<MndtId>MAND-001 &amp; MORE</MndtId>");
        } finally {
            jest.useRealTimers();
        }
    });

    test("buildPain008 validates the amount", () => {
        const account: SEPAAccount = {
            iban: "DE02120300000000202051",
            bic: "COBADEFFXXX",
            accountNumber: "102030",
            blz: "12030000",
        };
        const descriptor = "pain.008";
        const baseRequest: DirectDebitRequest = {
            creditorName: "ACME GmbH",
            creditorId: "DE98ZZZ09999999999",
            debtor: {
                name: "John Doe",
                iban: "DE02120300000000202051",
            },
            amount: 1,
            mandateId: "MANDATE-1",
            mandateSignatureDate: new Date("2021-01-02"),
            requestedCollectionDate: new Date("2021-03-04"),
        };

        expect(() => buildPain008({ ...baseRequest, amount: 0 }, account, descriptor)).toThrow(
            "Direct debit amount must be greater than zero.",
        );
        expect(() =>
            buildPain008(
                { ...baseRequest, mandateSignatureDate: new Date("invalid-date") },
                account,
                descriptor,
            ),
        ).toThrow("Mandate signature date must be a valid date.");
        expect(() =>
            buildPain008(
                { ...baseRequest, debtor: { ...baseRequest.debtor, name: "" } },
                account,
                descriptor,
            ),
        ).toThrow("Debtor name must be provided.");
    });

    test("buildPain001 applies defaults and escapes xml content", () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2020-04-05T06:07:08.009Z"));
        try {
            const account: SEPAAccount = {
                iban: "DE44500105175407324931",
                bic: "INGDDEFFXXX",
                accountNumber: "1234567",
                blz: "50010517",
            };
            const request: CreditTransferRequest = {
                debtorName: "  Jane & Co <>\"'  ",
                creditor: {
                    name: "  Receiver & Partners  ",
                    iban: "DE02120300000000202051",
                },
                amount: 42,
            };
            const descriptor = "urn?:iso?:std?:iso?:20022?:tech?:xsd?:pain.001.xsd";
            const result = buildPain001(request, account, descriptor);
            expect(result.messageId).toBe("CT-20200405060708009");
            expect(result.paymentInformationId).toBe("CT-20200405060708009");
            expect(result.endToEndId).toBe("NOTPROVIDED");
            expect(result.namespace).toBe("urn:iso:std:iso:20022:tech:xsd:pain.001");

            const xml = result.xml;
            expect(xml).toContain("<CreDtTm>2020-04-05T06:07:08</CreDtTm>");
            expect(xml).toContain("<BtchBookg>false</BtchBookg>");
            expect(xml).toContain("<InstdAmt Ccy=\"EUR\">42.00</InstdAmt>");
            expect(xml).toContain("<EndToEndId>NOTPROVIDED</EndToEndId>");
            expect(xml).toContain("<ReqdExctnDt>2020-04-05</ReqdExctnDt>");
            expect(xml).not.toContain("<CdtrAgt>");
            expect(xml).not.toContain("<RmtInf>");
            expect(xml).not.toContain("<Purp>");
            expect(xml).toContain("<Nm>Jane &amp; Co &lt;&gt;&quot;&apos;</Nm>");
            expect(xml).toContain("<Nm>Receiver &amp; Partners</Nm>");
        } finally {
            jest.useRealTimers();
        }
    });

    test("buildPain001 validates provided execution date", () => {
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
            },
            amount: 10,
            executionDate: new Date("invalid-date"),
        };
        expect(() => buildPain001(request, account, "pain.001")).toThrow(
            "Requested execution date must be a valid date.",
        );
    });

    test("buildDirectDebitSubmission wraps the pain.008 payload", () => {
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
            },
            amount: 25.5,
            endToEndId: "E2E-7",
            mandateId: "MANDATE-7",
            mandateSignatureDate: new Date("2021-01-01"),
            requestedCollectionDate: new Date("2021-01-02"),
            messageId: "MSG-7",
            paymentInformationId: "PMT-7",
        };
        const descriptor = "pain.008.003.02";
        const submission = buildDirectDebitSubmission(request, account, descriptor);
        expect(submission).toMatchObject({
            taskId: undefined,
            messageId: "MSG-7",
            paymentInformationId: "PMT-7",
            endToEndId: "E2E-7",
            painDescriptor: descriptor,
        });
        expect(submission.xml).toContain("<MsgId>MSG-7</MsgId>");
        expect(submission.xml).toContain("<PmtInfId>PMT-7</PmtInfId>");
    });

    test("buildCreditTransferSubmission wraps the pain.001 payload", () => {
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
            },
            amount: 50,
            endToEndId: "E2E-99",
            messageId: "MSG-99",
            paymentInformationId: "PMT-99",
        };
        const descriptor = "pain.001.003.03";
        const submission = buildCreditTransferSubmission(request, account, descriptor);
        expect(submission).toMatchObject({
            taskId: undefined,
            messageId: "MSG-99",
            paymentInformationId: "PMT-99",
            endToEndId: "E2E-99",
            painDescriptor: descriptor,
        });
        expect(submission.xml).toContain("<MsgId>MSG-99</MsgId>");
        expect(submission.xml).toContain("<PmtInfId>PMT-99</PmtInfId>");
    });
});
