/**
 * Configurable test data for the FinTS test server.
 *
 * Defines all bank data, accounts, balances, and transactions
 * that the test server will serve.
 */

export interface TestAccount {
    /** IBAN */
    iban: string;
    /** BIC */
    bic: string;
    /** Account number */
    accountNumber: string;
    /** Sub-account identifier */
    subAccount: string;
    /** Bank code (BLZ) */
    blz: string;
    /** Currency */
    currency: string;
    /** Account owner name */
    ownerName: string;
    /** Account name/type */
    accountName: string;
}

export interface TestBalance {
    /** Associated account number */
    accountNumber: string;
    /** Product name */
    productName: string;
    /** Currency */
    currency: string;
    /** Booked balance */
    bookedBalance: number;
    /** Pending balance */
    pendingBalance: number;
    /** Credit limit */
    creditLimit: number;
    /** Available balance */
    availableBalance: number;
}

export interface TestTransaction {
    /** Date of the transaction (yyyyMMdd) */
    date: string;
    /** Booking date (yyyyMMdd) */
    bookingDate: string;
    /** Amount (positive for credit, negative for debit) */
    amount: number;
    /** Currency */
    currency: string;
    /** Counterparty name */
    counterpartyName: string;
    /** Purpose / reference text */
    purpose: string;
    /** Transaction type (e.g., "NMSC" for miscellaneous) */
    transactionType?: string;
    /** Counterparty IBAN */
    counterpartyIban?: string;
    /** Counterparty BIC */
    counterpartyBic?: string;
    /** End-to-End Reference */
    eref?: string;
}

export interface TestUser {
    /** User name / login */
    name: string;
    /** PIN / password */
    pin: string;
}

export interface FinTSTestConfig {
    /** Bank code (Bankleitzahl) */
    blz: string;
    /** Bank name */
    bankName: string;
    /** BPD version */
    bpdVersion: number;
    /** Server URL (for HIKOM segment) */
    url: string;
    /** Allowed users */
    users: TestUser[];
    /** Available accounts */
    accounts: TestAccount[];
    /** Account balances */
    balances: TestBalance[];
    /** Transactions per account number */
    transactions: Record<string, TestTransaction[]>;
    /** SEPA pain formats supported */
    painFormats: string[];
    /** Whether to require TAN for certain operations */
    requireTan?: boolean;
}

/**
 * Generate a simple MT940 message from test transactions.
 *
 * Reference: SWIFT MT940 Customer Statement Message format.
 * Field tags: :20: (Reference), :25: (Account), :28C: (Statement number),
 * :60F: (Opening balance), :61: (Transaction), :86: (Details), :62F: (Closing balance)
 */
export function generateMT940(
    account: TestAccount,
    transactions: TestTransaction[],
    openingBalance: number,
): string {
    const lines: string[] = [];

    lines.push(`:20:STARTUMS`);
    lines.push(`:25:${account.blz}/${account.accountNumber}`);
    lines.push(`:28C:00001/001`);

    // Opening balance: :60F:C180101EUR1234,56
    const openingSign = openingBalance >= 0 ? "C" : "D";
    const openingAbs = Math.abs(openingBalance).toFixed(2).replace(".", ",");
    lines.push(`:60F:${openingSign}180101${account.currency}${openingAbs}`);

    let runningBalance = openingBalance;

    for (const tx of transactions) {
        const sign = tx.amount >= 0 ? "C" : "D";
        const absAmount = Math.abs(tx.amount).toFixed(2).replace(".", ",");
        const txType = tx.transactionType || "NMSC";

        // :61: Value date, booking date, sign, amount, transaction type, reference
        lines.push(`:61:${tx.date}${tx.bookingDate.slice(2)}${sign}${absAmount}${txType}NONREF`);

        // :86: Structured description (MT86)
        const detailParts = [`/EREF+${tx.eref || "NOTPROVIDED"}`];
        if (tx.counterpartyIban) {
            detailParts.push(`/IBAN+${tx.counterpartyIban}`);
        }
        if (tx.counterpartyBic) {
            detailParts.push(`/BIC+${tx.counterpartyBic}`);
        }
        detailParts.push(`/NAME+${tx.counterpartyName}`);
        detailParts.push(`/SVWZ+${tx.purpose}`);
        lines.push(`:86:166?00${txType}?20${detailParts.join("?21")}?32${tx.counterpartyName}?33`);

        runningBalance += tx.amount;
    }

    // Closing balance
    const closingSign = runningBalance >= 0 ? "C" : "D";
    const closingAbs = Math.abs(runningBalance).toFixed(2).replace(".", ",");
    lines.push(`:62F:${closingSign}181001${account.currency}${closingAbs}`);

    lines.push("-");

    return lines.join("\r\n");
}

/**
 * Default test configuration providing a complete test bank setup.
 */
export function createDefaultConfig(): FinTSTestConfig {
    return {
        blz: "12345678",
        bankName: "FinTS Test Bank",
        bpdVersion: 78,
        url: "http://localhost:3000/fints",
        users: [
            { name: "testuser", pin: "12345" },
        ],
        accounts: [
            {
                iban: "DE111234567800000001",
                bic: "GENODE00TES",
                accountNumber: "1",
                subAccount: "",
                blz: "12345678",
                currency: "EUR",
                ownerName: "Max Mustermann",
                accountName: "Girokonto",
            },
            {
                iban: "DE111234567800000002",
                bic: "GENODE00TES",
                accountNumber: "2",
                subAccount: "",
                blz: "12345678",
                currency: "EUR",
                ownerName: "Max Mustermann",
                accountName: "Tagesgeld",
            },
        ],
        balances: [
            {
                accountNumber: "1",
                productName: "Girokonto",
                currency: "EUR",
                bookedBalance: 1234.56,
                pendingBalance: 1234.56,
                creditLimit: 5000,
                availableBalance: 6234.56,
            },
            {
                accountNumber: "2",
                productName: "Tagesgeld",
                currency: "EUR",
                bookedBalance: 10000.00,
                pendingBalance: 10000.00,
                creditLimit: 0,
                availableBalance: 10000.00,
            },
        ],
        transactions: {
            "1": [
                {
                    date: "180901",
                    bookingDate: "180901",
                    amount: 1500.00,
                    currency: "EUR",
                    counterpartyName: "Arbeitgeber GmbH",
                    purpose: "Gehalt September 2018",
                    eref: "GEHALT-2018-09",
                    counterpartyIban: "DE89370400440532013000",
                    counterpartyBic: "COBADEFFXXX",
                },
                {
                    date: "180903",
                    bookingDate: "180903",
                    amount: -45.99,
                    currency: "EUR",
                    counterpartyName: "Stadtwerke Musterstadt",
                    purpose: "Stromabschlag September",
                    eref: "STROM-2018-09",
                    counterpartyIban: "DE27100777770209299700",
                    counterpartyBic: "DEUTDEFF500",
                },
                {
                    date: "180905",
                    bookingDate: "180905",
                    amount: -750.00,
                    currency: "EUR",
                    counterpartyName: "Vermieter Immobilien AG",
                    purpose: "Miete Oktober 2018",
                    eref: "MIETE-2018-10",
                    counterpartyIban: "DE02120300000000202051",
                    counterpartyBic: "BYLADEM1001",
                },
                {
                    date: "180910",
                    bookingDate: "180910",
                    amount: -29.99,
                    currency: "EUR",
                    counterpartyName: "Online Shop GmbH",
                    purpose: "Bestellung 12345",
                    eref: "BESTELLUNG-12345",
                },
                {
                    date: "180915",
                    bookingDate: "180915",
                    amount: 200.00,
                    currency: "EUR",
                    counterpartyName: "Erika Musterfrau",
                    purpose: "Rueckzahlung Auslagen",
                    eref: "RUECK-2018-001",
                    counterpartyIban: "DE91100000000123456789",
                    counterpartyBic: "MARKDEF1100",
                },
            ],
            "2": [
                {
                    date: "180901",
                    bookingDate: "180901",
                    amount: 5000.00,
                    currency: "EUR",
                    counterpartyName: "Max Mustermann",
                    purpose: "Umbuchung Tagesgeld",
                    eref: "UMBUCHUNG-001",
                    counterpartyIban: "DE111234567800000001",
                    counterpartyBic: "GENODE00TES",
                },
            ],
        },
        painFormats: [
            "sepade?:xsd?:pain.001.001.03.xsd",
            "sepade?:xsd?:pain.001.002.03.xsd",
            "sepade?:xsd?:pain.001.003.03.xsd",
            "sepade?:xsd?:pain.008.002.02.xsd",
            "sepade?:xsd?:pain.008.003.02.xsd",
        ],
        requireTan: false,
    };
}
