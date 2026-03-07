# FinTS Library - Quick Reference Guide

## Installation

```bash
npm install fints-lib
npm install -g fints-lib-cli  # For CLI
```

## Basic Usage (3 Steps)

```typescript
import { PinTanClient } from 'fints-lib';

// 1. Create client
const client = new PinTanClient({
    url: 'https://banking.example.com/fints',
    name: 'username',
    pin: '12345',
    blz: '12345678'
});

// 2. Get accounts
const accounts = await client.accounts();

// 3. Do something with account
const balance = await client.balance(accounts[0]);
```

## Common Operations

### List Accounts
```typescript
const accounts = await client.accounts();
accounts.forEach(acc => {
    console.log(`${acc.accountName}: ${acc.iban}`);
});
```

### Get Balance
```typescript
const balance = await client.balance(account);
console.log(`Balance: ${balance.bookedBalance} ${balance.currency}`);
console.log(`Available: ${balance.availableBalance}`);
```

### Fetch Statements
```typescript
const startDate = new Date('2024-01-01');
const endDate = new Date('2024-12-31');
const statements = await client.statements(account, startDate, endDate);

statements.forEach(stmt => {
    stmt.transactions.forEach(txn => {
        console.log(`${txn.amount} | ${txn.descriptionStructured?.name}`);
    });
});
```

### List Securities/Holdings
```typescript
const holdings = await client.holdings(account);
holdings.forEach(h => {
    console.log(`${h.name} (${h.isin}): ${h.totalValue} ${h.currency}`);
});
```

### List Standing Orders
```typescript
const orders = await client.standingOrders(account);
orders.forEach(o => {
    console.log(`${o.creditor.name}: ${o.amount} every ${o.interval} ${o.timeUnit}`);
});
```

## Payment Operations

### Send Money (Credit Transfer)
```typescript
try {
    const result = await client.creditTransfer(account, {
        debtorName: 'My Name',
        creditor: { name: 'Recipient', iban: 'DE44500105175407324931' },
        amount: 50.00,
        remittanceInformation: 'Invoice #123'
    });
    console.log('Success:', result.taskId);
} catch (e) {
    if (e instanceof TanRequiredError) {
        // Handle TAN requirement
    }
}
```

### Collect Money (Direct Debit)
```typescript
const result = await client.directDebit(account, {
    creditorName: 'My Company',
    creditorId: 'DE98ZZZ09999999999',
    debtor: { name: 'Customer', iban: 'DE02120300000000202051' },
    amount: 99.99,
    mandateId: 'MANDATE-001',
    mandateSignatureDate: new Date('2024-01-15'),
    requestedCollectionDate: new Date('2024-12-15')
});
```

## Handle TAN Challenges

### Regular TAN
```typescript
import { TanRequiredError } from 'fints-lib';

try {
    await client.creditTransfer(account, transfer);
} catch (error) {
    if (error instanceof TanRequiredError) {
        // Get TAN from user
        const tan = await getUserInput('Enter TAN: ');
        
        const result = await client.completeCreditTransfer(
            error.dialog,
            error.transactionReference,
            tan,
            error.creditTransferSubmission
        );
    }
}
```

### PSD2 Decoupled TAN (Async on Mobile App)
```typescript
try {
    await client.creditTransfer(account, transfer);
} catch (error) {
    if (error instanceof TanRequiredError && error.isDecoupledTan()) {
        // Challenge sent to user's mobile app - poll for confirmation
        const result = await client.handleDecoupledTanChallenge(
            error,
            (status) => {
                console.log(`State: ${status.state}`);
                console.log(`Requests: ${status.statusRequestCount}/${status.maxStatusRequests}`);
            }
        );
    }
}
```

## Core Types

### Account & Balance
```typescript
interface SEPAAccount {
    iban: string;              // DE89370400440532013000
    bic: string;               // COBADEFF
    accountNumber: string;     // 532013000
    blz: string;               // 37040044
    accountOwnerName?: string; // John Doe
    accountName?: string;      // Girokonto
    limitValue?: number;       // Credit limit
}

interface Balance {
    account: SEPAAccount;
    currency: string;          // EUR
    bookedBalance: number;     // 1500.50
    pendingBalance: number;    // 200.00
    creditLimit: number;       // 5000.00
    availableBalance: number;  // 6300.50
}
```

### Transaction
```typescript
interface Transaction {
    date: Date;
    amount: number;
    currency: string;          // EUR
    purpose: string;
    descriptionStructured?: {
        reference: {
            iban?: string;
            bic?: string;
            text?: string;    // Purpose
            endToEndRef?: string;
            mandateRef?: string;
        };
        name: string;         // Counterparty
    };
}

interface Statement {
    date: Date;
    transactions: Transaction[];
}
```

### Payment Requests
```typescript
interface CreditTransferRequest {
    debtorName: string;
    creditor: { name: string; iban: string; bic?: string };
    amount: number;
    currency?: string;        // Default: EUR
    remittanceInformation?: string;  // Purpose text
    executionDate?: Date;
}

interface DirectDebitRequest {
    creditorName: string;
    creditorId: string;
    debtor: { name: string; iban: string; bic?: string };
    amount: number;
    mandateId: string;
    mandateSignatureDate: Date;
    requestedCollectionDate: Date;
    sequenceType?: 'OOFF' | 'FRST' | 'RCUR' | 'FNAL';  // Default: OOFF
    localInstrument?: 'CORE' | 'B2B' | 'COR1';         // Default: CORE
}
```

### Holding
```typescript
interface Holding {
    isin?: string;             // DE0008404005
    name?: string;             // SAP SE
    marketPrice?: number;      // 125.50
    currency?: string;         // EUR
    valuationDate?: Date;
    pieces?: number;           // 100
    totalValue?: number;       // 12550.00
    acquisitionPrice?: number; // 120.00
}
```

## Error Handling

```typescript
import {
    TanRequiredError,
    DecoupledTanError,
    FinTSError,
    AuthenticationError,
    PinError,
    OrderRejectedError,
    StrongAuthenticationRequiredError
} from 'fints-lib';

try {
    // ... banking operation
} catch (error) {
    if (error instanceof TanRequiredError) {
        console.log('TAN required:', error.transactionReference);
        console.log('Challenge:', error.challengeText);
    } else if (error instanceof DecoupledTanError) {
        console.log('Decoupled TAN failed:', error.message);
    } else if (error instanceof AuthenticationError) {
        console.log('Auth failed:', error.code);
    } else if (error instanceof PinError) {
        console.log('Invalid PIN (code 9942)');
    } else if (error instanceof OrderRejectedError) {
        console.log('Payment rejected');
    } else if (error instanceof FinTSError) {
        console.log(`Error [${error.code}]: ${error.message}`);
    }
}
```

## Configuration Options

```typescript
const client = new PinTanClient({
    // Required
    url: string;           // Bank's FinTS URL
    name: string;          // Username
    pin: string;           // PIN code
    blz: string;           // Bank code (Bankleitzahl)
    
    // Optional
    productId?: string;    // Default: standard FinTS product ID
    debug?: boolean;       // Enable detailed logging
    timeout?: number;      // Request timeout (default: 30000ms)
    maxRetries?: number;   // Retry attempts (default: 3)
    retryDelay?: number;   // Delay between retries (default: 1000ms)
    
    // PSD2 Decoupled TAN
    decoupledTanConfig?: {
        maxStatusRequests?: number;         // Default: 60
        waitBeforeFirstStatusRequest?: number;  // Default: 2000ms
        waitBetweenStatusRequests?: number;     // Default: 2000ms
        totalTimeout?: number;              // Default: 300000ms (5 min)
    }
});
```

## CLI Quick Reference

```bash
# List accounts
fints-lib list-accounts --url https://... -n user -p pin -b blz

# Get balance
fints-lib get-balance --url https://... -n user -p pin -b blz --iban DE89...

# Fetch transactions
fints-lib fetch-transactions --url https://... -n user -p pin -b blz \
  --iban DE89... --start 2024-01-01 --end 2024-12-31 --json

# List securities
fints-lib list-holdings --url https://... -n user -p pin -b blz --iban DE89...

# Send money
fints-lib submit-credit-transfer --url https://... -n user -p pin -b blz \
  --account-iban DE89... --debtor-name "John" \
  --creditor-name "Recipient" --creditor-iban DE44... --amount 50

# Collect money
fints-lib submit-direct-debit --url https://... -n user -p pin -b blz \
  --account-iban DE89... --creditor-name "My Co" --creditor-id DE98ZZZ... \
  --debtor-name "Customer" --debtor-iban DE02... --amount 99.99 \
  --mandate-id MANDATE-001 --mandate-date 2024-01-15 \
  --collection-date 2024-12-15
```

## Best Practices

1. **Credential Security**
   ```typescript
   // ✅ Good
   const client = new PinTanClient({
       url: process.env.FINTS_URL,
       name: process.env.FINTS_USER,
       pin: process.env.FINTS_PIN,
       blz: process.env.FINTS_BLZ
   });
   
   // ❌ Bad
   const client = new PinTanClient({
       url: 'https://...',
       name: 'user123',
       pin: '12345',     // Never hardcode!
       blz: '12345678'
   });
   ```

2. **Error Handling**
   ```typescript
   try {
       // Operation
   } catch (error) {
       if (error instanceof TanRequiredError) {
           // Expected - handle TAN
       } else if (error instanceof FinTSError) {
           // Log error code and message
           console.error(`Error ${error.code}: ${error.message}`);
       } else {
           // Unexpected error
           throw error;
       }
   }
   ```

3. **Dialog Reuse**
   ```typescript
   // For multiple operations - reuse dialog
   const dialog = client.createDialog();
   await dialog.sync();
   await dialog.init();
   
   const accounts = await client.accounts(dialog);
   const balance = await client.balance(accounts[0], dialog);
   const statements = await client.statements(accounts[0], startDate, endDate, dialog);
   
   await dialog.end();
   ```

4. **Date Handling**
   ```typescript
   // Timezone matters!
   const endDate = new Date();           // Today, current time
   const startDate = new Date();
   startDate.setDate(startDate.getDate() - 30);  // 30 days ago
   
   const statements = await client.statements(account, startDate, endDate);
   ```

## Important Links

- **GitHub**: https://github.com/larsdecker/fints
- **npm Package**: https://www.npmjs.com/package/fints-lib
- **npm CLI**: https://www.npmjs.com/package/fints-lib-cli
- **FinTS Spec**: https://www.hbci-zka.de/
- **Bank List**: https://github.com/jhermsmeier/fints-institute-db
- **License**: MIT

## Troubleshooting

**"Bank does not advertise support for pain.001"**
→ Bank doesn't support credit transfers

**"Bank does not advertise support for pain.008"**
→ Bank doesn't support direct debits

**"Holdings are not supported by this bank"**
→ Account type doesn't support holdings queries

**PIN Error (9942)**
→ Incorrect PIN, check credentials

**Authentication Error (9110)**
→ Username or PIN incorrect, or FinTS not enabled

**TAN Required**
→ Operation needs manual confirmation, use completeCreditTransfer/completeDirectDebit

**Timeout**
→ Increase timeout: `new PinTanClient({..., timeout: 60000})`

**Registration Required**
→ Some banks require app registration with Die Deutsche Kreditwirtschaft
