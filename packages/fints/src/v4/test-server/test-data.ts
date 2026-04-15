/**
 * Test data for the FinTS 4.1 mock bank server.
 *
 * Contains realistic German banking test data following the FinTS 4.1 specification.
 * All data is fictional – no real bank accounts or persons are referenced.
 */

/**
 * Bank configuration for the test server.
 */
export const TEST_BANK = {
    blz: "76050101",
    bankName: "Sparkasse Teststadt",
    bic: "SSKNDE77XXX",
    bpdVersion: 85,
    updVersion: 3,
    supportedHbciVersions: ["3.0", "4.1"],
    supportedLanguages: ["de", "en"],
    supportedSecurityMethods: ["PIN_TAN"],
    painFormats: ["urn:iso:std:iso:20022:tech:xsd:pain.001.003.03", "urn:iso:std:iso:20022:tech:xsd:pain.002.003.03"],
    camtFormats: ["urn:iso:std:iso:20022:tech:xsd:camt.053.001.02", "urn:iso:std:iso:20022:tech:xsd:camt.052.001.02"],
};

/**
 * Test users recognized by the mock server.
 */
export const TEST_USERS: Record<string, { pin: string; name: string; systemId: string }> = {
    testuser: {
        pin: "12345",
        name: "Max Mustermann",
        systemId: "",
    },
    testuser2: {
        pin: "54321",
        name: "Erika Musterfrau",
        systemId: "",
    },
};

/**
 * TAN methods offered by the mock server.
 */
export const TEST_TAN_METHODS = [
    {
        securityFunction: "912",
        tanProcess: "2",
        techId: "pushTAN",
        name: "pushTAN 2.0",
        maxLengthInput: 6,
        allowedFormat: "1",
        cancellable: true,
        decoupledMaxStatusRequests: 60,
        decoupledWaitBeforeFirstStatusRequest: 5,
        decoupledWaitBetweenStatusRequests: 2,
    },
    {
        securityFunction: "913",
        tanProcess: "1",
        techId: "chipTAN",
        name: "chipTAN QR",
        maxLengthInput: 8,
        allowedFormat: "0",
        cancellable: false,
    },
];

/**
 * Test accounts for the mock server.
 */
export const TEST_ACCOUNTS = [
    {
        iban: "DE89370400440532013000",
        bic: "SSKNDE77XXX",
        accountNumber: "0532013000",
        blz: "76050101",
        ownerName: "Max Mustermann",
        accountName: "Girokonto",
        currency: "EUR",
    },
    {
        iban: "DE27100777770209299700",
        bic: "SSKNDE77XXX",
        accountNumber: "0209299700",
        blz: "76050101",
        ownerName: "Max Mustermann",
        accountName: "Sparkonto",
        currency: "EUR",
    },
];

/**
 * Segment capabilities advertised by the mock server.
 * These follow the FinTS 4.1 specification's parameter segments.
 */
export const TEST_SEGMENT_CAPABILITIES = [
    { type: "Balance", version: 7 },
    { type: "AccountStatement", version: 2 },
    { type: "AccountList", version: 1 },
    { type: "TAN", version: 7 },
    { type: "HISALS", version: 7 },
    { type: "HICAZS", version: 2 },
    { type: "HITANS", version: 7 },
];

/**
 * Build a realistic camt.053.001.02 XML document with German banking test data.
 */
export function buildTestCamt053(iban: string, currency = "EUR", startDate?: Date, endDate?: Date): string {
    const now = new Date();
    const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate || now;
    const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

    return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <GrpHdr>
      <MsgId>MSG-${fmtDate(now)}-001</MsgId>
      <CreDtTm>${now.toISOString()}</CreDtTm>
    </GrpHdr>
    <Stmt>
      <Id>STMT-${fmtDate(start)}-${fmtDate(end)}</Id>
      <ElctrncSeqNb>42</ElctrncSeqNb>
      <CreDtTm>${now.toISOString()}</CreDtTm>
      <Acct>
        <Id><IBAN>${iban}</IBAN></Id>
        <Ccy>${currency}</Ccy>
        <Svcr>
          <FinInstnId><BIC>${TEST_BANK.bic}</BIC></FinInstnId>
        </Svcr>
      </Acct>
      <Bal>
        <Tp><CdOrPrtry><Cd>PRCD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="${currency}">12345.67</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>${fmtDate(start)}</Dt></Dt>
      </Bal>
      <Bal>
        <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="${currency}">13095.67</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>${fmtDate(end)}</Dt></Dt>
      </Bal>
      <Ntry>
        <NtryRef>ENT-001</NtryRef>
        <Amt Ccy="${currency}">2500.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Sts>BOOK</Sts>
        <BookgDt><Dt>${fmtDate(start)}</Dt></BookgDt>
        <ValDt><Dt>${fmtDate(start)}</Dt></ValDt>
        <BkTxCd><Domn><Cd>PMNT</Cd><Fmly><Cd>RCDT</Cd><SubFmlyCd>ESCT</SubFmlyCd></Fmly></Domn></BkTxCd>
        <NtryDtls>
          <TxDtls>
            <Refs>
              <EndToEndId>GEHALT-${fmtDate(start)}</EndToEndId>
              <MndtId>MNDT-GEHALT-001</MndtId>
            </Refs>
            <RltdPties>
              <Dbtr><Nm>Arbeitgeber Test GmbH</Nm></Dbtr>
              <DbtrAcct><Id><IBAN>DE44500105175407324931</IBAN></Id></DbtrAcct>
            </RltdPties>
            <RltdAgts>
              <DbtrAgt><FinInstnId><BIC>INGDDEFFXXX</BIC></FinInstnId></DbtrAgt>
            </RltdAgts>
            <RmtInf><Ustrd>Gehalt ${start.toLocaleString("de-DE", { month: "long", year: "numeric" })}</Ustrd></RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
      <Ntry>
        <NtryRef>ENT-002</NtryRef>
        <Amt Ccy="${currency}">850.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <Sts>BOOK</Sts>
        <BookgDt><Dt>${fmtDate(start)}</Dt></BookgDt>
        <ValDt><Dt>${fmtDate(start)}</Dt></ValDt>
        <BkTxCd><Domn><Cd>PMNT</Cd><Fmly><Cd>ICDT</Cd><SubFmlyCd>ESCT</SubFmlyCd></Fmly></Domn></BkTxCd>
        <NtryDtls>
          <TxDtls>
            <Refs><EndToEndId>MIETE-${fmtDate(start)}</EndToEndId></Refs>
            <RltdPties>
              <Cdtr><Nm>Immobilien Verwaltung GmbH</Nm></Cdtr>
              <CdtrAcct><Id><IBAN>DE27100777770209299700</IBAN></Id></CdtrAcct>
            </RltdPties>
            <RmtInf><Ustrd>Miete Wohnung 4B ${start.toLocaleString("de-DE", { month: "long", year: "numeric" })}</Ustrd></RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
      <Ntry>
        <NtryRef>ENT-003</NtryRef>
        <Amt Ccy="${currency}">45.99</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <Sts>BOOK</Sts>
        <BookgDt><Dt>${fmtDate(start)}</Dt></BookgDt>
        <ValDt><Dt>${fmtDate(start)}</Dt></ValDt>
        <BkTxCd><Domn><Cd>PMNT</Cd><Fmly><Cd>ICDT</Cd><SubFmlyCd>ESCT</SubFmlyCd></Fmly></Domn></BkTxCd>
        <NtryDtls>
          <TxDtls>
            <Refs><EndToEndId>STROM-${fmtDate(start)}</EndToEndId><MndtId>MNDT-STROM-001</MndtId></Refs>
            <RltdPties>
              <Cdtr><Nm>Stadtwerke Teststadt</Nm></Cdtr>
              <CdtrAcct><Id><IBAN>DE91100000000123456789</IBAN></Id></CdtrAcct>
            </RltdPties>
            <RmtInf><Ustrd>Abschlag Strom/Gas Kundennr. 4711</Ustrd></RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
      <Ntry>
        <NtryRef>ENT-004</NtryRef>
        <Amt Ccy="${currency}">1100.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Sts>BOOK</Sts>
        <BookgDt><Dt>${fmtDate(end)}</Dt></BookgDt>
        <ValDt><Dt>${fmtDate(end)}</Dt></ValDt>
        <BkTxCd><Domn><Cd>PMNT</Cd><Fmly><Cd>RCDT</Cd><SubFmlyCd>ESCT</SubFmlyCd></Fmly></Domn></BkTxCd>
        <NtryDtls>
          <TxDtls>
            <Refs><EndToEndId>FREIBERUF-${fmtDate(end)}</EndToEndId></Refs>
            <RltdPties>
              <Dbtr><Nm>Consulting Kunde AG</Nm></Dbtr>
              <DbtrAcct><Id><IBAN>DE75512108001245126199</IBAN></Id></DbtrAcct>
            </RltdPties>
            <RltdAgts>
              <DbtrAgt><FinInstnId><BIC>SOLADEST600</BIC></FinInstnId></DbtrAgt>
            </RltdAgts>
            <RmtInf><Ustrd>Rechnung RE-2024-042 Beratungsleistung</Ustrd></RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
      <Ntry>
        <NtryRef>ENT-005</NtryRef>
        <Amt Ccy="${currency}">54.01</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <Sts>BOOK</Sts>
        <BookgDt><Dt>${fmtDate(end)}</Dt></BookgDt>
        <ValDt><Dt>${fmtDate(end)}</Dt></ValDt>
        <BkTxCd><Domn><Cd>PMNT</Cd><Fmly><Cd>ICDT</Cd><SubFmlyCd>ESCT</SubFmlyCd></Fmly></Domn></BkTxCd>
        <NtryDtls>
          <TxDtls>
            <Refs><EndToEndId>EINKAUF-${fmtDate(end)}</EndToEndId></Refs>
            <RltdPties>
              <Cdtr><Nm>REWE Markt GmbH</Nm></Cdtr>
              <CdtrAcct><Id><IBAN>DE86200800000970375700</IBAN></Id></CdtrAcct>
            </RltdPties>
            <RmtInf><Ustrd>REWE SAGT DANKE 54712</Ustrd></RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;
}
