# FinTS Test Server

A mock FinTS 3.0 banking server for integration testing. Implements the full FinTS protocol over HTTP with configurable test data.

## Features

- Full FinTS 3.0 protocol implementation (PIN/TAN)
- HTTP server accepting Base64-encoded FinTS messages
- Configurable test data (accounts, balances, transactions)
- MT940-format transaction statements
- Dialog lifecycle management (sync → init → request → end)
- PIN authentication validation
- Optional TAN challenge flow
- SEPA account listing, balance queries, statement retrieval
- Standing orders, credit transfers, direct debits

## Supported Operations

| Segment | Operation | Description |
|---------|-----------|-------------|
| HKSYN | Synchronization | System ID, BPD, TAN methods |
| HKIDN/HKVVB | Dialog Init | PIN/TAN authentication |
| HKSPA | SEPA Accounts | Account listing |
| HKSAL | Balance | Account balance query |
| HKKAZ | Statements | Transaction list (MT940) |
| HKCDB | Standing Orders | Recurring payment list |
| HKCCS | Credit Transfer | SEPA transfer |
| HKDSE | Direct Debit | SEPA direct debit |
| HKTAN | TAN | Challenge/response handling |
| HKEND | Dialog End | Session termination |

## Usage

### Basic Usage

```typescript
import { FinTSServer } from "fints-test-server";
import { PinTanClient } from "fints-lib";

// Start test server
const server = new FinTSServer({ port: 3000 });
await server.start();

// Use with PinTanClient
const client = new PinTanClient({
    blz: "12345678",
    name: "testuser",
    pin: "12345",
    url: server.url,
});

const accounts = await client.accounts();
console.log(accounts);
// [
//   { iban: "DE111234567800000001", bic: "GENODE00TES", accountNumber: "1", ... },
//   { iban: "DE111234567800000002", bic: "GENODE00TES", accountNumber: "2", ... }
// ]

const balance = await client.balance(accounts[0]);
console.log(balance);
// { bookedBalance: 1234.56, availableBalance: 6234.56, creditLimit: 5000, currency: "EUR" }

await server.stop();
```

### Custom Configuration

```typescript
import { FinTSServer, createDefaultConfig } from "fints-test-server";

const config = createDefaultConfig();

// Customize accounts
config.accounts = [
    {
        iban: "DE99999999990000000001",
        bic: "TESTDEFFXXX",
        accountNumber: "42",
        subAccount: "",
        blz: "12345678",
        currency: "EUR",
        ownerName: "Custom User",
        accountName: "Test Account",
    },
];

// Customize balances
config.balances = [
    {
        accountNumber: "42",
        productName: "Test Account",
        currency: "EUR",
        bookedBalance: 9999.99,
        pendingBalance: 9999.99,
        creditLimit: 0,
        availableBalance: 9999.99,
    },
];

// Customize transactions
config.transactions = {
    "42": [
        {
            date: "180901",
            bookingDate: "180901",
            amount: 1500.00,
            currency: "EUR",
            counterpartyName: "Employer Inc",
            purpose: "Salary September",
            eref: "SAL-2018-09",
        },
    ],
};

// Enable TAN requirement for transfers
config.requireTan = true;

const server = new FinTSServer({ config });
await server.start();
```

### Jest Integration

```typescript
import { FinTSServer, createDefaultConfig } from "fints-test-server";
import { PinTanClient } from "fints-lib";

describe("Banking integration", () => {
    let server: FinTSServer;

    beforeEach(async () => {
        server = new FinTSServer();
        await server.start();
    });

    afterEach(async () => {
        await server.stop();
    });

    it("should fetch accounts", async () => {
        const client = new PinTanClient({
            blz: "12345678",
            name: "testuser",
            pin: "12345",
            url: server.url,
        });

        const accounts = await client.accounts();
        expect(accounts.length).toBe(2);
    });
});
```

## Configuration

### `FinTSTestConfig`

| Property | Type | Description |
|----------|------|-------------|
| `blz` | `string` | Bank code (Bankleitzahl) |
| `bankName` | `string` | Bank display name |
| `bpdVersion` | `number` | BPD version number |
| `url` | `string` | Server URL (for HIKOM) |
| `users` | `TestUser[]` | Authorized users (name + PIN) |
| `accounts` | `TestAccount[]` | SEPA accounts |
| `balances` | `TestBalance[]` | Account balances |
| `transactions` | `Record<string, TestTransaction[]>` | Transactions per account |
| `painFormats` | `string[]` | Supported SEPA pain formats |
| `requireTan` | `boolean` | Require TAN for transfers |

## Default Test Data

The default configuration includes:
- **Bank**: "FinTS Test Bank" (BLZ: 12345678)
- **User**: testuser / 12345
- **Account 1**: DE111234567800000001 (Girokonto, balance: 1234.56 EUR)
- **Account 2**: DE111234567800000002 (Tagesgeld, balance: 10000.00 EUR)
- **Transactions**: 5 sample transactions on Account 1, 1 on Account 2
- **TAN Method**: mobile TAN (security function 942)
- **SEPA Formats**: pain.001.001.03, pain.001.002.03, pain.008.002.02, etc.
