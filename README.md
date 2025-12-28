# fints-lib

[![npm](https://img.shields.io/npm/v/fints-lib.svg)](https://www.npmjs.com/package/fints-lib)
[![CI](https://github.com/larsdecker/fints/actions/workflows/ci.yml/badge.svg)](https://github.com/larsdecker/fints/actions/workflows/ci.yml)

A client library for communicating with [FinTS servers](https://www.hbci-zka.de/).

> **Note:** This is a fork and continuation of the excellent work by [Frederick Gnodtke (Prior99)](https://github.com/Prior99/fints). We are grateful for the solid foundation and comprehensive implementation provided by the original project.

## 🎯 Improvements in this Fork

This fork includes several enhancements over the original project:

- ✅ **Updated Dependencies**: All dependencies updated to their latest stable versions for better security and performance
- ✅ **Modern TypeScript**: Updated to TypeScript 5.x with improved type safety
- ✅ **GitHub Actions**: Automated CI/CD pipeline for testing and npm publication
- ✅ **Active Maintenance**: Regular updates and dependency maintenance
- ✅ **Published as `fints-lib` and `fints-lib-cli`** on npm for easier installation

## 📦 Installation

For end users installing the library:

```bash
npm install fints-lib
# or
yarn add fints-lib
```

For the CLI tool:

```bash
npm install -g fints-lib-cli
# or
yarn global add fints-lib-cli
```

### Development Setup

This project uses **Yarn** as the package manager. To set up the development environment:

```bash
# Install dependencies
yarn install

# Build all packages
yarn build

# Run tests
yarn test

# Run linting
yarn lint
```

## 🚀 Quick Start

### Minimal Configuration

```typescript
import { PinTanClient } from "fints-lib";

// Create a client with minimal required configuration
const client = new PinTanClient({
    url: "https://banking.example.com/fints",  // Your bank's FinTS URL
    name: "username",                           // Your banking username
    pin: "12345",                               // Your banking PIN
    blz: "12345678",                            // Bank code (BLZ/Bankleitzahl)
});

// List all accounts
const accounts = await client.accounts();
console.log(accounts);
```

### CLI Quick Start

```bash
# Install globally
npm install -g fints-lib-cli

# List your accounts
fints-lib list-accounts \
  --url https://banking.example.com/fints \
  -n username \
  -p 12345 \
  -b 12345678
```

## 📖 Common Use Cases

### 1. Check Account Balance

```typescript
import { PinTanClient } from "fints-lib";

const client = new PinTanClient({
    url: process.env.FINTS_URL,
    name: process.env.FINTS_USERNAME,
    pin: process.env.FINTS_PIN,
    blz: process.env.FINTS_BLZ,
});

// Get all accounts
const accounts = await client.accounts();

// Check balance for first account
const balance = await client.balance(accounts[0]);
console.log(`Account: ${accounts[0].iban}`);
console.log(`Balance: ${balance.value.value} ${balance.value.currency}`);
```

**CLI Example:**
```bash
fints-lib get-balance \
  --url https://banking.example.com/fints \
  -n username -p 12345 -b 12345678 \
  -i DE89370400440532013000
```

### 2. Fetch Recent Transactions

```typescript
import { PinTanClient } from "fints-lib";

const client = new PinTanClient({
    url: process.env.FINTS_URL,
    name: process.env.FINTS_USERNAME,
    pin: process.env.FINTS_PIN,
    blz: process.env.FINTS_BLZ,
});

const accounts = await client.accounts();

// Fetch last 30 days of transactions
const startDate = new Date();
startDate.setDate(startDate.getDate() - 30);
const endDate = new Date();

const statements = await client.statements(accounts[0], startDate, endDate);

// Process transactions
statements.forEach(statement => {
    console.log(`Date: ${statement.date}`);
    statement.transactions.forEach(transaction => {
        console.log(`  ${transaction.descriptionStructured?.bookingText || 'Transaction'}`);
        console.log(`  Amount: ${transaction.amount} ${transaction.currency}`);
        console.log(`  Purpose: ${transaction.purpose || 'N/A'}`);
    });
});
```

**CLI Example:**
```bash
# Fetch transactions for the last 30 days
fints-lib fetch-transactions \
  --url https://banking.example.com/fints \
  -n username -p 12345 -b 12345678 \
  -i DE89370400440532013000 \
  -s 2024-11-01 -e 2024-12-01 \
  --json > transactions.json
```

### 3. SEPA Credit Transfer (Send Money)

```typescript
import { PinTanClient, TanRequiredError } from "fints-lib";

const client = new PinTanClient({
    url: process.env.FINTS_URL,
    name: process.env.FINTS_USERNAME,
    pin: process.env.FINTS_PIN,
    blz: process.env.FINTS_BLZ,
});

const accounts = await client.accounts();
const myAccount = accounts[0];

// Prepare transfer
const transfer = {
    debtorName: "John Doe",
    creditor: {
        name: "Recipient Name",
        iban: "DE44500105175407324931",
        bic: "INGDDEFFXXX",  // Optional for transfers within SEPA
    },
    amount: 50.00,
    remittanceInformation: "Payment for invoice #12345",
};

try {
    // Initiate transfer
    const result = await client.creditTransfer(myAccount, transfer);
    console.log("Transfer successful:", result.taskId);
} catch (error) {
    if (error instanceof TanRequiredError) {
        // TAN is required - get TAN from user
        const tan = "123456";  // Get from user input or TAN app
        
        const result = await client.completeCreditTransfer(
            error.dialog,
            error.transactionReference,
            tan,
            error.creditTransferSubmission
        );
        console.log("Transfer completed:", result.taskId);
    } else {
        throw error;
    }
}
```

**CLI Example:**
```bash
# Transfer money (will prompt for TAN if required)
fints-lib submit-credit-transfer \
  --url https://banking.example.com/fints \
  -n username -p 12345 -b 12345678 \
  --account-iban DE89370400440532013000 \
  --debtor-name "John Doe" \
  --creditor-name "Recipient Name" \
  --creditor-iban DE44500105175407324931 \
  --amount 50.00 \
  --remittance "Payment for invoice #12345"
```

### 4. SEPA Direct Debit (Collect Money)

```typescript
import { PinTanClient, TanRequiredError } from "fints-lib";

const client = new PinTanClient({
    url: process.env.FINTS_URL,
    name: process.env.FINTS_USERNAME,
    pin: process.env.FINTS_PIN,
    blz: process.env.FINTS_BLZ,
});

const accounts = await client.accounts();
const myAccount = accounts[0];

// Prepare direct debit
const debit = {
    creditorName: "My Company GmbH",
    creditorId: "DE98ZZZ09999999999",  // Your SEPA creditor ID
    debtor: {
        name: "Customer Name",
        iban: "DE02120300000000202051",
    },
    amount: 99.99,
    mandateId: "MANDATE-2024-001",
    mandateSignatureDate: new Date("2024-01-15"),
    requestedCollectionDate: new Date("2024-12-15"),
    remittanceInformation: "Monthly subscription fee",
};

try {
    const result = await client.directDebit(myAccount, debit);
    console.log("Direct debit submitted:", result.taskId);
} catch (error) {
    if (error instanceof TanRequiredError) {
        const tan = "123456";  // Get from user
        
        const result = await client.completeDirectDebit(
            error.dialog,
            error.transactionReference,
            tan,
            error.directDebitSubmission
        );
        console.log("Direct debit completed:", result.taskId);
    } else {
        throw error;
    }
}
```

**CLI Example:**
```bash
fints-lib submit-direct-debit \
  --url https://banking.example.com/fints \
  -n username -p 12345 -b 12345678 \
  --account-iban DE89370400440532013000 \
  --creditor-name "My Company GmbH" \
  --creditor-id DE98ZZZ09999999999 \
  --debtor-name "Customer Name" \
  --debtor-iban DE02120300000000202051 \
  --amount 99.99 \
  --mandate-id MANDATE-2024-001 \
  --mandate-date 2024-01-15 \
  --collection-date 2024-12-15 \
  --remittance "Monthly subscription fee"
```

### 5. List Multiple Accounts and Their Balances

```typescript
import { PinTanClient } from "fints-lib";

const client = new PinTanClient({
    url: process.env.FINTS_URL,
    name: process.env.FINTS_USERNAME,
    pin: process.env.FINTS_PIN,
    blz: process.env.FINTS_BLZ,
});

// Get all accounts with balances
const accounts = await client.accounts();

for (const account of accounts) {
    console.log(`\n${account.accountName || 'Account'} (${account.iban})`);
    console.log(`  Type: ${account.accountType || 'N/A'}`);
    
    try {
        const balance = await client.balance(account);
        console.log(`  Balance: ${balance.value.value} ${balance.value.currency}`);
        console.log(`  Available: ${balance.availableBalance?.value || 'N/A'}`);
    } catch (error) {
        console.log(`  Balance: Unable to fetch`);
    }
}
```

> Before using any FinTS library you have to register your application with Die Deutsche Kreditwirtschaft in order to get your registration number. Note that this process can take several weeks. First you receive your registration number after a couple days, but then you have to wait anywhere between 0 and 8+ weeks for the registration to reach your bank's server. If you have multiple banks, it probably reaches them at different times.
>
> -- https://github.com/nemiah/phpFinTS

## Packages

This library is maintained in a [monorepo using lerna](https://lernajs.io/). These packages are included:

 * [fints-lib](packages/fints) - Core library (Take a look for library usage instructions.)
 * [fints-lib-cli](packages/fints-cli) - Command line interface (Take a look for CLI usage instructions.)

## 🔒 Security

This library handles sensitive financial data and credentials. Please follow these security best practices:

### Credential Handling

- **Never log credentials**: The library masks PINs and TANs in debug output, but you should never log the raw configuration object
- **Store credentials securely**: Use environment variables or secure credential stores (e.g., AWS Secrets Manager, Azure Key Vault) instead of hardcoding credentials
- **Use HTTPS only**: Always use HTTPS URLs for FinTS endpoints to ensure encrypted communication
- **Debug mode**: Be cautious when enabling debug mode (`debug: true`) in production environments, as it logs detailed request/response information

### Example: Secure Credential Loading

```typescript
import { PinTanClient } from "fints-lib";

// ✅ Good: Load from environment variables
const client = new PinTanClient({
    url: process.env.FINTS_URL,
    name: process.env.FINTS_USERNAME,
    pin: process.env.FINTS_PIN,
    blz: process.env.FINTS_BLZ,
    debug: false, // Disable in production
});

// ❌ Bad: Hardcoded credentials
const badClient = new PinTanClient({
    url: "https://example.com/fints",
    name: "username",
    pin: "12345", // Never hardcode!
    blz: "12345678",
});
```

### Reporting Security Issues

If you discover a security vulnerability, please report it privately via GitHub's "Security" tab instead of opening a public issue.

## 💡 Tips and Troubleshooting

### Finding Your Bank's FinTS URL

You can find your bank's FinTS endpoint URL in this community database:
- [FinTS Institute Database](https://github.com/jhermsmeier/fints-institute-db)

### Common Issues

**Authentication Errors:**
- Verify your username, PIN, and BLZ are correct
- Some banks require you to enable FinTS/HBCI access in your online banking settings
- Check if your bank requires registration (see registration note below)

**TAN Requirements:**
- Many operations (transfers, direct debits) require TAN authentication
- Use try-catch with `TanRequiredError` to handle TAN challenges properly
- Some banks require TAN even for login - handle with `completeLogin()`

**Timeout Issues:**
- Increase the timeout value in client configuration:
  ```typescript
  const client = new PinTanClient({
      // ... other config
      timeout: 60000,  // 60 seconds
      maxRetries: 5,
  });
  ```

**Date Range Queries:**
- Not all banks support all date ranges - some limit how far back you can query
- Use shorter date ranges if you experience timeouts or errors

### Best Practices

1. **Always use environment variables for credentials:**
   ```typescript
   const client = new PinTanClient({
       url: process.env.FINTS_URL,
       name: process.env.FINTS_USERNAME,
       pin: process.env.FINTS_PIN,
       blz: process.env.FINTS_BLZ,
   });
   ```

2. **Enable debug mode during development:**
   ```typescript
   const client = new PinTanClient({
       // ... credentials
       debug: process.env.NODE_ENV === 'development',
   });
   ```

3. **Handle errors gracefully:**
   ```typescript
   import { FinTSError, TanRequiredError, PinError } from "fints-lib";
   
   try {
       const accounts = await client.accounts();
   } catch (error) {
       if (error instanceof TanRequiredError) {
           // Handle TAN requirement
       } else if (error instanceof PinError) {
           // Handle PIN error
       } else if (error instanceof FinTSError) {
           console.error(`FinTS Error [${error.code}]: ${error.message}`);
       }
   }
   ```

4. **Close dialogs when done:**
   ```typescript
   const dialog = await client.startDialog();
   try {
       // ... perform operations
   } finally {
       await dialog.end();
   }
   ```

## Mentions

FinTS is a complex and old format and this library wouldn't have been possible without the great work of:

- [Prior99/fints](https://github.com/Prior99/fints) - The original repository by Frederick Gnodtke that this fork is based on. Thank you for creating such a comprehensive and well-structured FinTS implementation! 🙏
- [python-fints](https://github.com/raphaelm/python-fints) was used a reference implementation.
- [Open-Fin-TS-JS-Client](https://github.com/jschyma/open_fints_js_client) provides a demo server used for testing this library.
- [mt940-js](https://github.com/webschik/mt940-js) is used internally for parsing the [MT940](https://en.wikipedia.org/wiki/MT940) format.

## Resources

- [API Reference](https://prior99.gitlab.io/fints)
- [Official specification](https://www.hbci-zka.de/spec/3_0.htm)
- [Database of banks with their URLs](https://github.com/jhermsmeier/fints-institute-db)

## Contributing

Contributions in the form of well-documented issues or pull-requests are welcome.

## Contributors

 - Frederick Gnodtke (Original author)
 - Lars Decker (Fork maintainer)
