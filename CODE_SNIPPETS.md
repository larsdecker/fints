# FinTS Library - Key Code Snippets & Examples

## Quick Start Example

```typescript
import { PinTanClient, TanRequiredError } from 'fints-lib';

// Create client with PIN/TAN credentials
const client = new PinTanClient({
    url: 'https://banking.example.com/fints',
    name: 'username',
    pin: '12345',
    blz: '12345678',  // German bank code
});

// List all accounts
const accounts = await client.accounts();
console.log(accounts);
// Output: [
//   {
//     iban: 'DE89370400440532013000',
//     bic: 'COBADEFF',
//     accountNumber: '532013000',
//     blz: '37040044',
//     accountOwnerName: 'John Doe',
//     accountName: 'Girokonto'
//   }
// ]

// Get balance for first account
const balance = await client.balance(accounts[0]);
console.log(balance);
// Output: {
//   account: {...},
//   productName: 'Girokonto',
//   currency: 'EUR',
//   bookedBalance: 1500.50,
//   pendingBalance: 200.00,
//   creditLimit: 5000.00,
//   availableBalance: 6300.50
// }

// Fetch statements (last 30 days)
const endDate = new Date();
const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
const statements = await client.statements(accounts[0], startDate, endDate);

statements.forEach(stmt => {
    console.log(`Statement: ${stmt.date}`);
    stmt.transactions.forEach(txn => {
        console.log(`  ${txn.amount} ${txn.currency} - ${txn.descriptionStructured?.name || 'N/A'}`);
        if (txn.descriptionStructured?.reference) {
            console.log(`    IBAN: ${txn.descriptionStructured.reference.iban}`);
            console.log(`    Purpose: ${txn.descriptionStructured.reference.text}`);
        }
    });
});
```

## Handling TAN Requirements

### Regular TAN Challenge

```typescript
try {
    const result = await client.creditTransfer(account, {
        debtorName: 'John Doe',
        creditor: { name: 'Recipient', iban: 'DE44500105175407324931' },
        amount: 50.00,
        remittanceInformation: 'Payment for invoice #123'
    });
    console.log('Transfer successful:', result.taskId);
} catch (error) {
    if (error instanceof TanRequiredError) {
        // TAN required - get from user
        const tan = '123456';  // From user input or TAN app
        
        const result = await client.completeCreditTransfer(
            error.dialog,
            error.transactionReference,
            tan,
            error.creditTransferSubmission
        );
        console.log('Transfer completed:', result.taskId);
    }
}
```

### PSD2 Decoupled TAN (Async on Mobile App)

```typescript
try {
    const result = await client.directDebit(account, {
        creditorName: 'My Company GmbH',
        creditorId: 'DE98ZZZ09999999999',
        debtor: { name: 'Customer', iban: 'DE02120300000000202051' },
        amount: 99.99,
        mandateId: 'MANDATE-2024-001',
        mandateSignatureDate: new Date('2024-01-15'),
        requestedCollectionDate: new Date('2024-12-15'),
        remittanceInformation: 'Monthly subscription'
    });
} catch (error) {
    if (error instanceof TanRequiredError && error.isDecoupledTan()) {
        // Decoupled TAN: challenge sent to user's mobile app
        // Poll for confirmation with status updates
        const result = await client.handleDecoupledTanChallenge(
            error,
            (status) => {
                console.log(`[${status.state}] Requests: ${status.statusRequestCount}/${status.maxStatusRequests}`);
                console.log(`Challenge: ${status.challengeText}`);
            }
        );
        console.log('Direct debit confirmed:', result);
    }
}
```

## Core Type Definitions

### Account & Balance Types

```typescript
// Account information from bank
interface SEPAAccount {
    iban: string;              // e.g., "DE89370400440532013000"
    bic: string;               // e.g., "COBADEFF"
    accountNumber: string;     // e.g., "532013000"
    accountOwnerName?: string; // Account holder name
    accountName?: string;      // Product name: "Girokonto", "Sparkonto"
    blz: string;               // Bank code (Bankleitzahl)
    limitValue?: number;       // Credit/overdraft limit
    subAccount?: string;       // Optional sub-account identifier
}

// Balance information
interface Balance {
    account: SEPAAccount;
    productName: string;
    currency: string;          // ISO 4217: "EUR", "GBP", etc.
    bookedBalance: number;     // Confirmed balance
    pendingBalance: number;    // Pending transactions (not yet booked)
    creditLimit: number;       // Available credit
    availableBalance: number;  // Balance available to spend
}
```

### Transaction Types

```typescript
interface Transaction extends MT940Transaction {
    // Extended with structured 86 section parsing
    descriptionStructured?: StructuredDescription;
}

interface StructuredDescription {
    reference: PaymentReference;  // Parsed MT940-86 fields
    name: string;                 // Counterparty name
    iban: string;                 // Counterparty IBAN
    bic: string;                  // Counterparty BIC
    text: string;                 // Raw description
    primaNota: string;            // German bank-specific field
}

interface PaymentReference {
    raw: string;                  // Unparsed reference
    iban?: string;                // IBAN+ tag
    bic?: string;                 // BIC+ tag
    endToEndRef?: string;         // EREF+ (end-to-end reference)
    customerRef?: string;         // KREF+ (customer reference)
    mandateRef?: string;          // MREF+ (mandate for direct debits)
    creditorId?: string;          // CRED+ (creditor ID for direct debits)
    bank?: string;                // BREF+ (bank reference)
    date?: Date;                  // DATUM (transaction date)
    text?: string;                // SVWZ+ (purpose/description)
    purpose?: string;             // Purpose code
    // ... more fields
}

interface Statement extends MT940Statement {
    transactions: Transaction[];
}
```

### Payment Types

```typescript
// Credit Transfer (Überweisung / SEPA CT / PAIN.001)
interface CreditTransferRequest {
    debtorName: string;           // Payer name
    creditor: {
        name: string;
        iban: string;
        bic?: string;             // Optional for SEPA
    };
    amount: number;
    currency?: string;            // Default: "EUR"
    endToEndId?: string;          // Unique reference ID
    remittanceInformation?: string; // Purpose/invoice reference
    purposeCode?: string;         // SEPA purpose code (e.g., "SALA")
    executionDate?: Date;         // When to execute
    batchBooking?: boolean;       // Combine with other transfers?
    messageId?: string;           // Generated if not provided
}

// Direct Debit (Lastschrift / SEPA DD / PAIN.008)
type DirectDebitScheme = "CORE" | "B2B" | "COR1";  // Scheme types
type DirectDebitSequenceType = "OOFF" | "FRST" | "RCUR" | "FNAL";

interface DirectDebitRequest {
    creditorName: string;         // Creditor (money receiver)
    creditorId: string;           // Creditor ID
    debtor: {
        name: string;             // Debtor (payer)
        iban: string;
        bic?: string;
    };
    amount: number;
    mandateId: string;            // Mandate reference
    mandateSignatureDate: Date;  // When mandate was signed
    requestedCollectionDate: Date; // When to collect
    sequenceType?: DirectDebitSequenceType; // Default: "OOFF"
    localInstrument?: DirectDebitScheme;    // Default: "CORE"
    // ... other fields
}
```

### Securities/Holdings Types

```typescript
interface Holding {
    isin?: string;                // International Securities ID
    name?: string;                // Security name
    marketPrice?: number;         // Latest market price
    currency?: string;            // e.g., "EUR"
    valuationDate?: Date;         // Price valuation date
    pieces?: number;              // Number of units held
    totalValue?: number;          // Market value of position
    acquisitionPrice?: number;    // Cost price per unit
}
```

### Standing Orders

```typescript
interface StandingOrder {
    nextOrderDate: Date;          // Next execution date
    timeUnit: string;             // "M"=monthly, "Q"=quarterly, "Y"=yearly
    interval: number;            // e.g., 1, 3, 6, 12
    orderDay?: number;           // Day of month (1-31)
    lastOrderDate?: Date;        // Last execution or null
    creationDate: Date;          // When created
    debitor: PartyIdentification;  // Money source
    creditor: PartyIdentification; // Money destination
    amount: number;
    paymentPurpose: string;      // Description
}
```

### Error Handling

```typescript
// TAN process error
export class TanRequiredError extends Error {
    transactionReference: string;  // Server reference
    challengeText: string;         // Challenge to show user
    challengeMedia: Buffer;        // Image/media if present
    dialog: Dialog;                // Authenticated session
    decoupledTanState?: DecoupledTanState; // PSD2 async state
    directDebitSubmission?: DirectDebitSubmission;  // Saved for completion
    creditTransferSubmission?: CreditTransferSubmission; // Saved for completion
}

// PSD2 Decoupled TAN
enum DecoupledTanState {
    INITIATED = "initiated",
    CHALLENGE_SENT = "challenge_sent",
    PENDING_CONFIRMATION = "pending_confirmation",
    CONFIRMED = "confirmed",
    FAILED = "failed",
    CANCELLED = "cancelled",
    TIMED_OUT = "timed_out"
}

interface DecoupledTanConfig {
    maxStatusRequests?: number;              // Default: 60
    waitBeforeFirstStatusRequest?: number;   // Default: 2000ms
    waitBetweenStatusRequests?: number;      // Default: 2000ms
    totalTimeout?: number;                   // Default: 300000ms
}

// Error base class
class FinTSError extends Error {
    code: string;      // Error code (e.g., "9942" for PIN error)
    returnValue?: ReturnValue;
}

// Specific error subclasses
class PinError extends FinTSError {}           // Code 9942
class AuthenticationError extends FinTSError {} // Code 9110
class OrderRejectedError extends FinTSError {}  // Codes 9120, 9140
class StrongAuthenticationRequiredError extends FinTSError {} // PSD2 codes
```

## Main Client Methods

```typescript
class PinTanClient extends Client {
    // Construction
    constructor(config: {
        url: string;
        name: string;
        pin: string;
        blz: string;
        productId?: string;
        debug?: boolean;
        timeout?: number;
        maxRetries?: number;
        decoupledTanConfig?: DecoupledTanConfig;
    });

    // Account operations
    async accounts(existingDialog?: Dialog): Promise<SEPAAccount[]>
    async balance(account: SEPAAccount, dialog?: Dialog): Promise<Balance>
    async statements(account, startDate?, endDate?, dialog?): Promise<Statement[]>
    async holdings(account: SEPAAccount, dialog?: Dialog): Promise<Holding[]>
    async standingOrders(account: SEPAAccount, dialog?: Dialog): Promise<StandingOrder[]>

    // Payments
    async creditTransfer(account, request): Promise<CreditTransferSubmission>
    async directDebit(account, request): Promise<DirectDebitSubmission>
    
    // Completions (after TAN)
    async completeCreditTransfer(dialog, transRef, tan, submission)
    async completeDirectDebit(dialog, transRef, tan, submission)
    async completeStatements(dialog, transRef, tan): Promise<Statement[]>
    async completeLogin(dialog, transRef, tan): Promise<Dialog>

    // PSD2 Decoupled TAN
    async handleDecoupledTanChallenge(
        error: TanRequiredError,
        statusCallback?: (status) => void
    ): Promise<Response>
}
```

## Dialog Lifecycle

```typescript
const client = new PinTanClient({...});

// Option 1: Automatic dialog management (most cases)
const accounts = await client.accounts();  // Dialog created & destroyed

// Option 2: Manual dialog control (for multiple operations)
const dialog = client.createDialog();
await dialog.sync();        // Get system info
await dialog.init();        // Authenticate

const accounts = await client.accounts(dialog);
const balance = await client.balance(accounts[0], dialog);
const holdings = await client.holdings(accounts[0], dialog);

await dialog.end();         // Close session
```

## Build & Test Commands

```bash
# Development
yarn install          # Install dependencies
yarn build           # Compile TypeScript → dist/
yarn test            # Run unit tests
yarn test:acceptance # Run E2E tests
yarn lint            # Check code style
yarn lint:fix        # Fix linting issues
yarn format          # Format with Prettier

# Production
npm install fints-lib          # Install library
npm install -g fints-lib-cli   # Install CLI globally

# CLI Usage
fints-lib list-accounts --url https://... -n username -p pin -b blz
fints-lib get-balance --url ... --iban DE89...
fints-lib fetch-transactions --url ... --iban DE89... -s 2024-01-01 -e 2024-12-31
fints-lib list-holdings --url ... --iban DE89...
fints-lib submit-credit-transfer --url ... --creditor-iban DE44... --amount 50
fints-lib submit-direct-debit --url ... --debtor-iban DE02... --amount 99.99
```

## File Organization

```
Key Implementation Files:
  client.ts (409 lines)         - Abstract client with 10+ methods
  pin-tan-client.ts (135 lines) - PIN/TAN implementation
  dialog.ts (329 lines)         - Session management, sync/init/end
  request.ts (155 lines)        - Serialize segments to protocol
  response.ts (220 lines)       - Parse protocol responses
  types.ts (409 lines)          - All 40+ domain interfaces/types
  pain.ts (408 lines)           - PAIN.001 & .008 XML generation
  mt535.ts (167 lines)          - Holdings/securities parser
  mt940-86-structured.ts (205)  - Transaction reference parser

Segment Files (55 total):
  HKIDN - Identification
  HKSPA - Account list request
  HKSAL - Balance request
  HKKAZ - Statement request
  HKWPD - Holdings/securities request
  HKSYN - Synchronization
  HKTAN - TAN method/challenge
  HKCCS - Credit transfer
  HKCDB - Direct debit
  HNVSK/HNVSD - Encryption
  ... and 45+ more

Error Handling (8+ files):
  fints-error.ts - Base + 7 specialized error classes
  tan-required-error.ts - TAN challenge
  response-error.ts - Server response errors
  decoupled-tan-error.ts - PSD2 async errors
  error-codes.ts - Error code mappings

Tests (15+ in fints, 2+ in cli):
  __tests__/
    test-pin-tan-client.ts - Main client functionality
    test-client.ts - Abstract base
    test-pain.ts - PAIN generation
    test-mt535.ts - Holdings parsing
    test-mt940-86-structured.ts - Transaction parsing
    ... and 10+ more
```

## Version Info

```
fints-lib: 0.8.0
fints-lib-cli: 0.4.0
TypeScript: 5.9.3
Node: 18+ recommended
Jest: 30.2.0
License: MIT
Repository: https://github.com/larsdecker/fints
```

___BEGIN___COMMAND_DONE_MARKER___0
