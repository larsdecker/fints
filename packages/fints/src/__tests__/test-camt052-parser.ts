import { parseCamt052 } from "../camt052-parser";

const parse = (xml: string) => parseCamt052(xml) as any[];

const MINIMAL_XML = `<Document>
  <BkToCstmrAcctRpt>
    <Rpt>
      <Acct><Id><IBAN>DE27100777770209299700</IBAN></Id></Acct>
      <Bal>
        <Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">1000.00</Amt>
        <Dt><Dt>2024-01-01</Dt></Dt>
      </Bal>
      <Bal>
        <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">950.00</Amt>
        <Dt><Dt>2024-01-02</Dt></Dt>
      </Bal>
      <Ntry>
        <Amt Ccy="EUR">100.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <AcctSvcrRef>TXN-CREDIT</AcctSvcrRef>
        <BookgDt><Dt>2024-01-02</Dt></BookgDt>
        <ValDt><Dt>2024-01-02</Dt></ValDt>
        <NtryDtls>
          <TxDtls>
            <Dbtr><Nm>Jane Sender</Nm></Dbtr>
            <DbtrAcct><Id><IBAN>DE12345678901234567890</IBAN></Id></DbtrAcct>
            <DbtrAgt><FinInstnId><BICFI>TESTBIC0</BICFI></FinInstnId></DbtrAgt>
            <RmtInf><Ustrd>Invoice 42</Ustrd></RmtInf>
            <Refs>
              <EndToEndId>E2E-001</EndToEndId>
              <MndtId>MNDT-001</MndtId>
            </Refs>
          </TxDtls>
        </NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="EUR">150.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <AcctSvcrRef>TXN-DEBIT</AcctSvcrRef>
        <BookgDt><Dt>2024-01-02</Dt></BookgDt>
        <ValDt><Dt>2024-01-02</Dt></ValDt>
        <NtryDtls>
          <TxDtls>
            <Cdtr><Nm>ACME Corp</Nm></Cdtr>
            <CdtrAcct><Id><IBAN>DE98765432109876543210</IBAN></Id></CdtrAcct>
            <CdtrAgt><FinInstnId><BICFI>ACMEBIC0</BICFI></FinInstnId></CdtrAgt>
            <RmtInf><Ustrd>Monthly fee</Ustrd></RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
    </Rpt>
  </BkToCstmrAcctRpt>
</Document>`;

describe("parseCamt052", () => {
    test("returns empty array for XML without Rpt elements", () => {
        expect(parse("<Document></Document>")).toEqual([]);
    });

    test("parses account identification from IBAN tag", () => {
        const [statement] = parse(MINIMAL_XML) as any[];
        expect(statement.accountIdentification).toBe("DE27100777770209299700");
    });

    test("parses opening and closing balances", () => {
        const [statement] = parse(MINIMAL_XML);
        expect(statement.openingBalance?.value).toBe(1000.0);
        expect(statement.openingBalance?.currency).toBe("EUR");
        expect(statement.closingBalance?.value).toBe(950.0);
    });

    test("parses correct number of transactions", () => {
        const [statement] = parse(MINIMAL_XML);
        expect(statement.transactions).toHaveLength(2);
    });

    describe("credit transaction", () => {
        test("sets isCredit and isExpense correctly", () => {
            const [{ transactions }] = parse(MINIMAL_XML);
            const tx = transactions[0];
            expect(tx.isCredit).toBe(true);
            expect(tx.isExpense).toBe(false);
        });

        test("sets amount and currency", () => {
            const [{ transactions }] = parse(MINIMAL_XML);
            const tx = transactions[0];
            expect(tx.amount).toBe(100.0);
            expect(tx.currency).toBe("EUR");
        });

        test("sets id from AcctSvcrRef", () => {
            const [{ transactions }] = parse(MINIMAL_XML);
            expect(transactions[0].id).toBe("TXN-CREDIT");
        });

        test("sets name from debtor for credit transactions", () => {
            const [{ transactions }] = parse(MINIMAL_XML);
            expect(transactions[0].name).toBe("Jane Sender");
        });

        test("sets description from Ustrd", () => {
            const [{ transactions }] = parse(MINIMAL_XML);
            expect(transactions[0].description).toBe("Invoice 42");
        });

        test("sets bankReference equal to description", () => {
            const [{ transactions }] = parse(MINIMAL_XML);
            const tx = transactions[0];
            expect(tx.bankReference).toBe(tx.description);
        });

        test("populates descriptionStructured", () => {
            const [{ transactions }] = parse(MINIMAL_XML);
            const structured = transactions[0].descriptionStructured;
            expect(structured.name).toBe("Jane Sender");
            expect(structured.text).toBe("Invoice 42");
            expect(structured.iban).toBe("DE12345678901234567890");
            expect(structured.bic).toBe("TESTBIC0");
            expect(structured.reference.endToEndRef).toBe("E2E-001");
            expect(structured.reference.mandateRef).toBe("MNDT-001");
        });
    });

    describe("debit transaction", () => {
        test("sets isCredit and isExpense correctly", () => {
            const [{ transactions }] = parse(MINIMAL_XML);
            const tx = transactions[1];
            expect(tx.isCredit).toBe(false);
            expect(tx.isExpense).toBe(true);
        });

        test("sets name from creditor for debit transactions", () => {
            const [{ transactions }] = parse(MINIMAL_XML);
            expect(transactions[1].name).toBe("ACME Corp");
        });

        test("sets counterparty IBAN from creditor account", () => {
            const [{ transactions }] = parse(MINIMAL_XML);
            const structured = transactions[1].descriptionStructured;
            expect(structured.iban).toBe("DE98765432109876543210");
            expect(structured.bic).toBe("ACMEBIC0");
        });
    });

    test("handles namespaced XML tags", () => {
        const xml = `<ns2:Document xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:camt.052.001.08">
          <ns2:BkToCstmrAcctRpt>
            <ns2:Rpt>
              <ns2:Acct><ns2:Id><ns2:IBAN>DE99000000000000000000</ns2:IBAN></ns2:Id></ns2:Acct>
              <ns2:Ntry>
                <ns2:Amt Ccy="EUR">50.00</ns2:Amt>
                <ns2:CdtDbtInd>CRDT</ns2:CdtDbtInd>
                <ns2:AcctSvcrRef>NS-TXN</ns2:AcctSvcrRef>
                <ns2:BookgDt><ns2:Dt>2024-03-01</ns2:Dt></ns2:BookgDt>
              </ns2:Ntry>
            </ns2:Rpt>
          </ns2:BkToCstmrAcctRpt>
        </ns2:Document>`;
        const [statement] = parse(xml);
        expect(statement.accountIdentification).toBe("DE99000000000000000000");
        expect(statement.transactions).toHaveLength(1);
        expect(statement.transactions[0].amount).toBe(50.0);
        expect(statement.transactions[0].id).toBe("NS-TXN");
    });
});
