/**
 * Test data for the FinTS 3.0 mock bank server.
 *
 * Contains realistic German banking test data following the FinTS 3.0 specification.
 * All data is fictional – no real bank accounts or persons are referenced.
 */

/**
 * Bank configuration for the test server.
 */
export const TEST_BANK_V3 = {
    blz: "76050101",
    bankName: "Sparkasse Teststadt",
    bic: "SSKNDE77XXX",
    bpdVersion: 85,
    updVersion: 3,
    countryCode: "280",
    hbciVersion: "300",
};

/**
 * Test users recognized by the mock server.
 */
export const TEST_USERS_V3: Record<string, { pin: string; name: string; systemId: string }> = {
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
 * These follow the HITANS segment format.
 */
export const TEST_TAN_METHODS_V3 = [
    {
        securityFunction: "912",
        tanProcess: "2",
        techId: "pushTAN",
        name: "pushTAN 2.0",
        maxLengthInput: 6,
        allowedFormat: "1",
        returnValueLength: 0,
        numStatusRequests: 60,
        firstDelaySeconds: 5,
        delayBetweenSeconds: 2,
    },
    {
        securityFunction: "913",
        tanProcess: "1",
        techId: "chipTAN",
        name: "chipTAN QR",
        maxLengthInput: 8,
        allowedFormat: "0",
        returnValueLength: 0,
        numStatusRequests: 0,
        firstDelaySeconds: 0,
        delayBetweenSeconds: 0,
    },
];

/**
 * Test accounts for the mock server.
 */
export const TEST_ACCOUNTS_V3 = [
    {
        iban: "DE89370400440532013000",
        bic: "SSKNDE77XXX",
        accountNumber: "0532013000",
        subAccount: "",
        blz: "76050101",
        ownerName: "Max Mustermann",
        currency: "EUR",
        accountType: "1",
    },
    {
        iban: "DE27100777770209299700",
        bic: "SSKNDE77XXX",
        accountNumber: "0209299700",
        subAccount: "",
        blz: "76050101",
        ownerName: "Max Mustermann",
        currency: "EUR",
        accountType: "1",
    },
];

/**
 * Test task IDs assigned by the mock server for submitted orders.
 */
export const TEST_TASK_ID = "TASK-001-TEST";

/**
 * A minimal PAIN.001 XML used in standing order test responses.
 */
export function buildTestPain001ForStandingOrder(): string {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.003.03">',
        "  <CstmrCdtTrfInitn>",
        "    <GrpHdr>",
        `      <MsgId>STND-${dateStr}</MsgId>`,
        `      <CreDtTm>${dateStr}T00:00:00</CreDtTm>`,
        "      <NbOfTxs>1</NbOfTxs>",
        "      <CtrlSum>500.00</CtrlSum>",
        "      <InitgPty><Nm>Max Mustermann</Nm></InitgPty>",
        "    </GrpHdr>",
        "    <PmtInf>",
        "      <PmtInfId>PII-001</PmtInfId>",
        "      <PmtMtd>TRF</PmtMtd>",
        "      <NbOfTxs>1</NbOfTxs>",
        "      <CtrlSum>500.00</CtrlSum>",
        "      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>",
        `      <ReqdExctnDt>${dateStr}</ReqdExctnDt>`,
        "      <Dbtr><Nm>Max Mustermann</Nm></Dbtr>",
        "      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>",
        "      <DbtrAgt><FinInstnId><BIC>SSKNDE77XXX</BIC></FinInstnId></DbtrAgt>",
        "      <ChrgBr>SLEV</ChrgBr>",
        "      <CdtTrfTxInf>",
        "        <PmtId><EndToEndId>STND-E2E-001</EndToEndId></PmtId>",
        "        <Amt><InstdAmt Ccy=\"EUR\">500.00</InstdAmt></Amt>",
        "        <CdtrAgt><FinInstnId><BIC>COBADEFFXXX</BIC></FinInstnId></CdtrAgt>",
        "        <Cdtr><Nm>Immobilien Verwaltung GmbH</Nm></Cdtr>",
        "        <CdtrAcct><Id><IBAN>DE27100777770209299700</IBAN></Id></CdtrAcct>",
        "        <RmtInf><Ustrd>Miete Monat</Ustrd></RmtInf>",
        "      </CdtTrfTxInf>",
        "    </PmtInf>",
        "  </CstmrCdtTrfInitn>",
        "</Document>",
    ].join(" ");
}

/**
 * Build a realistic MT940 statement for a test account.
 * MT940 is the SWIFT format used by FinTS 3.0 for account statements.
 */
export function buildTestMT940(accountNumber: string, blz: string, currency = "EUR"): string {
    const today = new Date();
    const yy = String(today.getFullYear()).slice(2);
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const dateShort = `${yy}${mm}${dd}`;

    return [
        `:20:STARTUMS`,
        `:25:${blz}/${accountNumber}`,
        `:28C:00042/001`,
        `:60F:C${dateShort}${currency}12345,67`,
        // Salary credit
        `:61:${dateShort}${dateShort}CR2500,00N051NONREF`,
        `:86:166?00SEPA Credit Transfer?10SALARY?20SVWZ+Gehalt ${mm}/${today.getFullYear()}?21EREF+GEHALT-${dateShort}?22KREF+MNDT-GEHALT-001?30INGDDEFFXXX?31DE44500105175407324931?32Arbeitgeber Test GmbH?34912`,
        // Rent debit
        `:61:${dateShort}${dateShort}DR850,00N051NONREF`,
        `:86:166?00SEPA Credit Transfer?10RENT?20SVWZ+Miete Wohnung 4B?21EREF+MIETE-${dateShort}?30COBADEFFXXX?31DE27100777770209299700?32Immobilien Verwaltung GmbH?34912`,
        // Utility debit
        `:61:${dateShort}${dateShort}DR45,99N051NONREF`,
        `:86:166?00SEPA Direct Debit?10UTIL?20SVWZ+Abschlag Strom/Gas?21EREF+STROM-${dateShort}?22KREF+MNDT-STROM-001?30COBADEFFXXX?31DE91100000000123456789?32Stadtwerke Teststadt?34912`,
        // Freelance credit
        `:61:${dateShort}${dateShort}CR1100,00N051NONREF`,
        `:86:166?00SEPA Credit Transfer?10FREELNC?20SVWZ+Rechnung RE-2024-042?21EREF+FREIBERUF-${dateShort}?30SOLADEST600?31DE75512108001245126199?32Consulting Kunde AG?34912`,
        // Grocery debit
        `:61:${dateShort}${dateShort}DR54,01N051NONREF`,
        `:86:166?00SEPA Credit Transfer?10GROCRY?20SVWZ+REWE SAGT DANKE 54712?21EREF+EINKAUF-${dateShort}?30COBADEFFXXX?31DE86200800000970375700?32REWE Markt GmbH?34912`,
        `:62F:C${dateShort}${currency}13095,67`,
        `-`,
    ].join("\r\n");
}

/**
 * Build a minimal MT535 holdings report for a test depot account.
 * MT535 is the SWIFT format used by FinTS 3.0 for securities portfolios.
 */
export function buildTestMT535(): string {
    const today = new Date();
    const yy = String(today.getFullYear()).slice(2);
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const date6 = `${yy}${mm}${dd}`;

    return [
        `:16R:GENL`,
        `:28E:1/LAST`,
        `:20C::SEME//NONREF`,
        `:23G:NEWM`,
        `:98C::PREP//${date6}000000`,
        `:16S:GENL`,
        `:16R:SUBSAFE`,
        `:16R:FIN`,
        `:35B:ISIN DE0007664039`,
        `/DE/766403`,
        `Volkswagen AG`,
        `:90B::MRKT//EUR/175,50`,
        `:93B::AGGR//FAMT/10,`,
        `:94B::SAFE//NCSD/CLEARSTREM`,
        `:98A::PRIC//20240101`,
        `:16S:FIN`,
        `:16S:SUBSAFE`,
        `-`,
    ].join("\r\n");
}
