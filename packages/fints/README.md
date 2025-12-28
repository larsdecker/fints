# fints-lib

[![npm](https://img.shields.io/npm/v/fints-lib.svg)](https://www.npmjs.com/package/fints-lib)
[![CI](https://github.com/larsdecker/fints/actions/workflows/ci.yml/badge.svg)](https://github.com/larsdecker/fints/actions/workflows/ci.yml)

A client library for communicating with [FinTS servers](https://www.hbci-zka.de/).

> **Note:** This is a fork and continuation of [Prior99/fints](https://github.com/Prior99/fints). Published as `fints-lib` on npm.

## Installation

```bash
npm install fints-lib
# or
yarn add fints-lib
```

## Quick Start Examples

### Basic Account Information

```typescript
import { PinTanClient } from "fints-lib";

// Initialize client with minimal configuration
const client = new PinTanClient({
    url: "https://banking.example.com/fints",
    name: "username",
    pin: "12345",
    blz: "12345678",
});

// Fetch all accounts
const accounts = await client.accounts();
console.log(accounts); // List of all accounts

// Get balance for first account
const balance = await client.balance(accounts[0]);
console.log(`Balance: ${balance.value.value} ${balance.value.currency}`);
```

### Fetching Transactions

```typescript
import { PinTanClient } from "fints-lib";

const client = new PinTanClient({
    url: "https://banking.example.com/fints",
    name: "username",
    pin: "12345",
    blz: "12345678",
});

const accounts = await client.accounts();

// Fetch transactions for a date range
const startDate = new Date("2024-01-01");
const endDate = new Date("2024-12-31");
const statements = await client.statements(accounts[0], startDate, endDate);

// Process transactions
statements.forEach(statement => {
    console.log(`Statement from ${statement.date}`);
    statement.transactions.forEach(tx => {
        console.log(`  ${tx.descriptionStructured?.bookingText}: ${tx.amount} ${tx.currency}`);
    });
});
```


### Handling login TAN challenges

Some banks require a TAN as part of the login dialog. When that happens the library raises a `TanRequiredError`. The error now includes enhanced information about the TAN process state and context. You can complete the login by submitting the TAN and continue working with the returned dialog:

```typescript
import { TanRequiredError, TanProcessStep } from "fints-lib";

try {
    const accounts = await client.accounts();
} catch (error) {
    if (error instanceof TanRequiredError) {
        // Enhanced error information
        console.log("TAN Challenge:", error.challengeText);
        console.log("Process Step:", error.getStepDescription());
        console.log("Triggering Segment:", error.triggeringSegment);
        console.log("Is Multi-Step:", error.isMultiStep());
        
        // Complete the login with TAN
        const dialog = await client.completeLogin(error.dialog, error.transactionReference, "123456");
        const accounts = await client.accounts(dialog);
        await dialog.end();
    }
}
```

[Submitting SEPA credit transfers](#submitting-a-credit-transfer)
[Submitting SEPA direct debits](#submitting-a-direct-debit)

[Further code examples](README_advanced_usage.md)

## Features

- **FinTS 3.0 Compatibility**: Full support for FinTS 3.0 (HBCI version 300) protocol
- **Enhanced Error Handling**: Comprehensive error code mapping with specific exception types
- **Timeout & Retry**: Configurable HTTP timeouts and automatic retry with exponential backoff
- **Multi-Step TAN Flows**: Enhanced support for complex TAN authentication flows
- Load list of accounts.
- Load list of statements and transactions in specified range.
- Fetch current account balances.
- List depot holdings.
- Initiate SEPA credit transfers (pain.001) with TAN handling.
- Submit SEPA direct debit orders (pain.008) with TAN handling.
- Parse statement [MT940](https://en.wikipedia.org/wiki/MT940) format.
- Parse transaction descriptions.
- Extract [reference tags](https://www.dzbank.de/content/dam/dzbank_de/de/home/produkte_services/Firmenkunden/PDF-Dokumente/transaction%20banking/elektronicBanking/SEPA-Belegungsregeln_MT940-DK_082016.~644b217ec96b35dfffcaf18dc2df800a.pdf) from transactions.
- List supported TAN methods.
- Parse basic metadata.

## Configuration Options

### Basic Configuration

```typescript
const client = new PinTanClient({
    url: "https://example.com/fints",
    name: "username",
    pin: 12345,
    blz: 12345678,
});
```

### Advanced Configuration with Timeout & Retry

```typescript
const client = new PinTanClient({
    url: "https://example.com/fints",
    name: "username",
    pin: 12345,
    blz: 12345678,
    // Optional: Configure HTTP timeout (default: 30000ms)
    timeout: 45000,
    // Optional: Configure max retry attempts (default: 3)
    maxRetries: 5,
    // Optional: Configure retry delay for exponential backoff (default: 1000ms)
    retryDelay: 2000,
    // Optional: Enable debug mode
    debug: true,
});
```

## Error Handling

The library now provides comprehensive error handling with specific exception types:

```typescript
import {
    FinTSError,
    AuthenticationError,
    PinError,
    OrderRejectedError,
    DialogAbortedError,
    StrongAuthenticationRequiredError,
} from "fints-lib";

try {
    const accounts = await client.accounts();
} catch (error) {
    if (error instanceof PinError) {
        console.error("PIN is incorrect:", error.message);
    } else if (error instanceof AuthenticationError) {
        console.error("Authentication failed:", error.message);
    } else if (error instanceof StrongAuthenticationRequiredError) {
        console.error("Strong customer authentication (PSD2) required:", error.message);
    } else if (error instanceof FinTSError) {
        console.error("FinTS error:", error.code, error.message);
    }
}
```

### Error Code Mapping

All FinTS error codes are now mapped to descriptive messages:

```typescript
import { formatErrorCode, getErrorCodeInfo } from "fints-lib";

// Get detailed information about an error code
const info = getErrorCodeInfo("9942"); // PIN incorrect
console.log(info.category); // "error"
console.log(info.message); // "PIN falsch"

// Format error code with message
const formatted = formatErrorCode("9942", "Custom message");
// Output: "[9942] PIN falsch - Custom message"
```

## Common Use Cases

### Check Account Balance

```typescript
import { PinTanClient } from "fints-lib";

const client = new PinTanClient({
    url: process.env.FINTS_URL,
    name: process.env.FINTS_USERNAME,
    pin: process.env.FINTS_PIN,
    blz: process.env.FINTS_BLZ,
});

const accounts = await client.accounts();

// Get balance for a specific account
const balance = await client.balance(accounts[0]);
console.log(`Current Balance: ${balance.value.value} ${balance.value.currency}`);
console.log(`Available: ${balance.availableBalance?.value || 'N/A'}`);
```

### Fetch Recent Transactions

```typescript
import { PinTanClient } from "fints-lib";

const client = new PinTanClient({
    url: process.env.FINTS_URL,
    name: process.env.FINTS_USERNAME,
    pin: process.env.FINTS_PIN,
    blz: process.env.FINTS_BLZ,
});

const accounts = await client.accounts();

// Get transactions from the last 30 days
const endDate = new Date();
const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

const statements = await client.statements(accounts[0], startDate, endDate);

statements.forEach(statement => {
    console.log(`\nStatement: ${statement.date}`);
    statement.transactions.forEach(tx => {
        const booking = tx.descriptionStructured?.bookingText || 'Transaction';
        const purpose = tx.purpose || '';
        console.log(`  ${booking}: ${tx.amount} ${tx.currency}`);
        if (purpose) console.log(`    Purpose: ${purpose}`);
    });
});
```

### List All Accounts with Details

```typescript
import { PinTanClient } from "fints-lib";

const client = new PinTanClient({
    url: process.env.FINTS_URL,
    name: process.env.FINTS_USERNAME,
    pin: process.env.FINTS_PIN,
    blz: process.env.FINTS_BLZ,
});

const accounts = await client.accounts();

console.log(`Found ${accounts.length} account(s):\n`);

for (const account of accounts) {
    console.log(`Account: ${account.accountName || 'Unnamed'}`);
    console.log(`  IBAN: ${account.iban}`);
    console.log(`  Type: ${account.accountType || 'N/A'}`);
    console.log(`  Number: ${account.accountNumber || 'N/A'}`);
    
    try {
        const balance = await client.balance(account);
        console.log(`  Balance: ${balance.value.value} ${balance.value.currency}`);
    } catch (error) {
        console.log(`  Balance: Unable to retrieve`);
    }
    console.log();
}
```

### Working with Environment Variables (Recommended)

```typescript
import { PinTanClient } from "fints-lib";

// Create client using environment variables for credentials
// Ensure environment variables are set before running
if (!process.env.FINTS_URL || !process.env.FINTS_USERNAME || 
    !process.env.FINTS_PIN || !process.env.FINTS_BLZ) {
    throw new Error("Required environment variables are not set");
}

const client = new PinTanClient({
    url: process.env.FINTS_URL,
    name: process.env.FINTS_USERNAME,
    pin: process.env.FINTS_PIN,
    blz: process.env.FINTS_BLZ,
    debug: process.env.NODE_ENV === "development",
});

// Example .env file:
// FINTS_URL=https://banking.example.com/fints
// FINTS_USERNAME=myusername
// FINTS_PIN=mypin
// FINTS_BLZ=12345678
// NODE_ENV=development
```

## Missing


## Submitting a credit transfer

```typescript
import { PinTanClient, TanRequiredError, CreditTransferRequest } from "fints-lib";

const client = new PinTanClient({
    url: "https://example.com/fints",
    name: "username",
    pin: 12345,
    blz: 12345678,
});

const accounts = await client.accounts();
const account = accounts[0];

const transfer: CreditTransferRequest = {
    debtorName: "John Doe",
    creditor: {
        name: "ACME GmbH",
        iban: "DE44500105175407324931",
        bic: "INGDDEFFXXX",
    },
    amount: 100.0,
    remittanceInformation: "Invoice 0815",
};

try {
    const submission = await client.creditTransfer(account, transfer);
    console.log(submission.taskId);
} catch (error) {
    if (error instanceof TanRequiredError) {
        const submission = error.creditTransferSubmission!;
        const completed = await client.completeCreditTransfer(
            error.dialog,
            error.transactionReference,
            "123456",
            submission,
        );
        console.log(completed.taskId);
    }
}
```

## Submitting a direct debit

```typescript
import { PinTanClient, TanRequiredError, DirectDebitRequest } from "fints-lib";

const client = new PinTanClient({
    url: "https://example.com/fints",
    name: "username",
    pin: 12345,
    blz: 12345678,
});

const accounts = await client.accounts();
const account = accounts[0];

const debit: DirectDebitRequest = {
    creditorName: "ACME GmbH",
    creditorId: "DE98ZZZ09999999999",
    debtor: {
        name: "John Doe",
        iban: "DE02120300000000202051",
    },
    amount: 42.5,
    mandateId: "MANDATE-123",
    mandateSignatureDate: new Date("2022-01-10"),
    requestedCollectionDate: new Date(),
    remittanceInformation: "Invoice 0815",
};

try {
    const submission = await client.directDebit(account, debit);
    console.log(submission.taskId);
} catch (error) {
    if (error instanceof TanRequiredError) {
        const submission = error.directDebitSubmission!;
        const completed = await client.completeDirectDebit(
            error.dialog,
            error.transactionReference,
            "123456",
            submission,
        );
        console.log(completed.taskId);
    }
}
```

## Resources

- [API Reference](https://prior99.gitlab.io/fints)
- [Official specification](https://www.hbci-zka.de/spec/3_0.htm)
- [Database of banks with their URLs](https://github.com/jhermsmeier/fints-institute-db)
