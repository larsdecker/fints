
╔════════════════════════════════════════════════════════════════════════════╗
║                FinTS LIBRARY - COMPREHENSIVE ANALYSIS                      ║
╚════════════════════════════════════════════════════════════════════════════╝

## 1. DIRECTORY STRUCTURE (2-3 Levels Deep)

/home/runner/work/fints/fints/
├── packages/
│   ├── fints/                          # Core FinTS library v0.8.0
│   │   ├── src/
│   │   │   ├── __tests__/ (15+ test files)
│   │   │   ├── segments/ (55+ FinTS protocol segment types)
│   │   │   ├── decoupled-tan/ (PSD2 async authentication)
│   │   │   ├── errors/ (error classes)
│   │   │   ├── client.ts (abstract base)
│   │   │   ├── pin-tan-client.ts (main implementation)
│   │   │   ├── types.ts (409 lines - all domain types)
│   │   │   ├── dialog.ts (session management)
│   │   │   ├── request.ts, response.ts (protocol)
│   │   │   ├── mt535.ts, mt940-86-structured.ts (parsers)
│   │   │   ├── pain.ts (SEPA XML generation)
│   │   │   └── [utilities & constants]
│   │   └── package.json (published as fints-lib)
│   │
│   └── fints-cli/                      # CLI tool v0.4.0
│       ├── src/
│       │   ├── __tests__/ (2 test files)
│       │   ├── commands/ (6 CLI commands)
│       │   └── config.ts, index.ts
│       └── package.json (published as fints-lib-cli)
│
├── .github/workflows/ (ci.yml, publish.yml)
├── README.md, IMPLEMENTATION_SUMMARY.md, PUBLISHING.md
├── Makefile, tsconfig.json, lerna.json


## 2. MAIN PACKAGES/MODULES

📦 fints-lib (Core Library)
   - Entry: src/index.ts → dist/index.js (compiled)
   - Main Class: PinTanClient extends Client
   - 41 exports covering all banking functionality

📦 fints-lib-cli (Command-line)
   - Entry: src/index.ts → dist/index.js
   - CLI Command: fints-lib
   - 6 Commands: list-accounts, get-balance, fetch-transactions, 
                list-holdings, submit-credit-transfer, submit-direct-debit


## 3. HOW THE FINTS LIBRARY WORKS

Architecture Flow:
┌─────────────────────┐
│   PinTanClient      │  ← Main entry point (user creates this)
│ (PIN/TAN auth)      │
└──────────┬──────────┘
           │
    ┌──────▼──────────────┐
    │ Dialog (session)    │  ← Manages bank connection
    │ - sync/init/end     │
    └──────┬──────────────┘
           │
    ┌──────▼──────────────────┐
    │ Request → HttpConnection │  ← Send encrypted messages
    │ (segments, PIN/TAN)      │
    └──────────────────────────┘
           │
    ┌──────▼──────────────────┐
    │ Response (parse reply)   │
    │ - Find segments          │
    └──────────────────────────┘
           │
    ┌──────▼──────────────────────────┐
    │ Data Parsers                     │
    │ - MT940 (transactions)           │
    │ - MT535 (securities)             │
    │ - PAIN (payment XML)             │
    └──────────────────────────────────┘

Core Classes:
  • Client (abstract)
  • PinTanClient (concrete PIN/TAN implementation)
  • Dialog (session & credential management)
  • Request (serialize segments to protocol)
  • Response (parse protocol segments)
  • 55+ Segment types (HKIDN, HKSAL, HKKAZ, HKWPD, HKSPA, HKTAB, 
                       HKCCS, HKCDB, HKTAN, HNVSK, HNVSD, etc.)

## 4. EXISTING CAPABILITIES/FEATURES TRACKED

✅ Account Management
   - List all SEPA accounts
   - Get account balances (booked, pending, available, credit limit)
   - Account details (IBAN, BIC, account number, BLZ, owner name)

✅ Transactions & Statements
   - Fetch MT940 bank statements
   - Date range queries
   - Structured transaction parsing (MT940-86 tags)
   - Transaction references: IBAN, BIC, references, purpose codes

✅ Securities & Holdings
   - List depot account holdings
   - Parse MT535 format
   - Security details: ISIN, name, price, currency, valuation date
   - Pieces, total value, acquisition price

✅ Standing Orders
   - List standing orders
   - Order details: frequency, next date, creditor/debtor, amount, purpose

✅ SEPA Payments
   - Credit Transfers (PAIN.001) with SEPA XML generation
   - Direct Debits (PAIN.008) with multiple schemes (CORE, B2B, COR1)
   - Sequence types: OOFF, FRST, RCUR, FNAL
   - Batch booking support

✅ TAN (2-Factor Authentication)
   - Regular TAN challenges
   - PSD2 Decoupled TAN (async on mobile app)
   - Status polling with callbacks
   - Configurable timeouts

✅ Error Handling
   - Comprehensive error codes (9942, 9110, 3076, 3956, 9120, etc.)
   - Error class hierarchy
   - Formatted error messages


## 5. BUILD & TEST INSTRUCTIONS

Build:
  make build              # Full build
  yarn lerna run build    # Using lerna
  cd packages/fints && yarn build  # Individual package

Tests:
  make test                              # All tests except E2E
  yarn lerna run test                    # Via lerna
  TZ=UTC yarn test --testPathIgnorePatterns=test-pin-tan-client-e2e
  TZ=UTC yarn test:acceptance            # E2E only

Tests: ~200 tests, 87.56% coverage
  - 15+ unit test files in fints
  - 2+ CLI integration tests
  - Uses Jest 30.2.0 with ts-jest
  - Test fixtures in JSON format

Linting:
  yarn lint      # Check
  yarn lint:fix  # Fix issues

CI/CD:
  GitHub Actions: ci.yml (tests), publish.yml (npm auto-publish)


## 6. TYPESCRIPT TYPES FOR BANKING DOMAIN

All in /src/types.ts (409 lines) plus complementary files:

┌─────────────────────────────────────────────────────────────┐
│ ACCOUNT TYPES                                               │
├─────────────────────────────────────────────────────────────┤
interface SEPAAccount {
  iban, bic, accountNumber, accountOwnerName, accountName,
  blz, subAccount, limitValue
}
interface Balance {
  account, productName, currency, bookedBalance,
  pendingBalance, creditLimit, availableBalance
}
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ TRANSACTION TYPES                                           │
├─────────────────────────────────────────────────────────────┤
interface Transaction extends MT940Transaction {
  descriptionStructured?: StructuredDescription
}
interface StructuredDescription {
  reference, name, iban, text, bic, primaNota
}
interface PaymentReference {
  raw, iban, bic, endToEndRef, customerRef,
  mandateRef, creditorId, originalTurnover,
  divergingPrincipal, bank, back, originatorId,
  date, tan, text, purpose
}
interface Statement extends MT940Statement {
  transactions: Transaction[]
}
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SECURITIES/HOLDINGS TYPES                                  │
├─────────────────────────────────────────────────────────────┤
interface Holding {
  isin, name, marketPrice, currency,
  valuationDate, pieces, totalValue, acquisitionPrice
}
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STANDING ORDER TYPES                                        │
├─────────────────────────────────────────────────────────────┤
interface StandingOrder {
  nextOrderDate, timeUnit, interval, orderDay,
  lastOrderDate, creationDate, debitor, creditor,
  amount, paymentPurpose
}
interface PartyIdentification {
  name, iban, bic
}
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ CREDIT TRANSFER TYPES (Überweisung / PAIN.001)             │
├─────────────────────────────────────────────────────────────┤
interface CreditTransferRequest {
  debtorName, creditor: {name, iban, bic},
  amount, currency, endToEndId, remittanceInformation,
  purposeCode, executionDate, batchBooking,
  messageId, paymentInformationId, creationDateTime
}
interface CreditTransferSubmission {
  taskId, messageId, paymentInformationId,
  endToEndId, painDescriptor, xml
}
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ DIRECT DEBIT TYPES (Lastschrift / PAIN.008)                │
├─────────────────────────────────────────────────────────────┤
type DirectDebitScheme = "CORE" | "B2B" | "COR1"
type DirectDebitSequenceType = "OOFF" | "FRST" | "RCUR" | "FNAL"

interface DirectDebitRequest {
  creditorName, creditorId, debtor: {name, iban, bic},
  amount, currency, endToEndId, remittanceInformation,
  purposeCode, mandateId, mandateSignatureDate,
  requestedCollectionDate, sequenceType, localInstrument,
  batchBooking, messageId, paymentInformationId, creationDateTime
}
interface DirectDebitSubmission {
  taskId, messageId, paymentInformationId,
  endToEndId, painDescriptor, xml
}
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ DECOUPLED TAN / PSD2 TYPES                                  │
├─────────────────────────────────────────────────────────────┤
enum DecoupledTanState {
  INITIATED, CHALLENGE_SENT, PENDING_CONFIRMATION,
  CONFIRMED, FAILED, CANCELLED, TIMED_OUT
}
interface DecoupledTanStatus {
  state, transactionReference, challengeText,
  statusRequestCount, maxStatusRequests, startTime,
  errorMessage, returnCode
}
interface DecoupledTanConfig {
  maxStatusRequests?, waitBeforeFirstStatusRequest?,
  waitBetweenStatusRequests?, totalTimeout?
}
type DecoupledTanStatusCallback = (status) => void
└─────────────────────────────────────────────────────────────┘


## 7. ALL TYPE DEFINITION FILES

Primary:
  ✓ /src/types.ts (409 lines - 40+ interfaces & 10+ types)

Complementary:
  ✓ /src/pin-tan-client.ts (PinTanClientConfig)
  ✓ /src/client.ts (Client abstract class)
  ✓ /src/dialog.ts (Dialog, DialogConfig classes)
  ✓ /src/request.ts (Request, RequestConfig classes)
  ✓ /src/response.ts (Response class)
  ✓ /src/http-connection.ts (HttpConnection, ConnectionConfig)
  ✓ /src/tan-method.ts (TanMethod class)
  ✓ /src/return-value.ts (ReturnValue class)
  ✓ /src/error-codes.ts (FinTSErrorCodeInfo interface)
  ✓ /src/errors/fints-error.ts (FinTSError + 7 subclasses)
  ✓ /src/errors/tan-required-error.ts (TanRequiredError, TanProcessStep)
  ✓ /src/decoupled-tan/types.ts (DecoupledTanState, DecoupledTanConfig, etc.)
  ✓ /src/pain-formats.ts (Pain001Document, PAIN XML structures)
  ✓ /src/pain.ts (Pain008Message, Pain001Message)
  ✓ /src/segments/segment.ts (Segment<T> abstract, SegmentProps)
  ✓ /src/segments/[55 segment files] (HKIDN, HKSAL, HKKAZ, etc.)


## 8. MAIN INDEX/EXPORTS (/src/index.ts)

41 Export Groups:
  export * from "./client"                    // Client base
  export * from "./pin-tan-client"            // PinTanClient
  export * from "./types"                     // All domain types
  export * from "./dialog"                    // Dialog, DialogConfig
  export * from "./request"                   // Request, RequestConfig
  export * from "./response"                  // Response
  export * from "./segments"                  // 55+ segment types
  export * from "./tan-method"                // TanMethod
  export * from "./error-codes"               // Error code mappings
  export * from "./errors/fints-error"        // FinTSError + subclasses
  export * from "./errors/tan-required-error" // TanRequiredError
  export * from "./errors/decoupled-tan-error" // DecoupledTanError
  export * from "./decoupled-tan"             // DecoupledTanManager, config
  export * from "./pain"                      // PAIN builders
  export * from "./pain-formats"              // PAIN format types
  export * from "./mt535"                     // MT535Parser
  export * from "./mt940-86-structured"       // MT940-86 parser
  export * from "./http-connection"           // HttpConnection
  export * from "./constants"                 // Constants
  export * from "./logger"                    // Logger
  export * from "./format"                    // Format utils
  export * from "./parse"                     // Parse utils
  export * from "./utils"                     // Encode/decode, escaping
  [+20 more specific exports]

Public API (what end-users interact with):
  • PinTanClient - main class
  • SEPAAccount, Balance, Statement, Transaction, Holding
  • CreditTransferRequest/Submission
  • DirectDebitRequest/Submission
  • TanRequiredError, DecoupledTanError, FinTSError
  • All type definitions above


## 9. TEST STRUCTURE & RUNNING

Test Configuration:
  Framework: Jest 30.2.0
  Transformer: ts-jest
  Pattern: **/src/**/__tests__/test-*.ts
  Coverage: 87.56% statement coverage
  Timezone: UTC (TZ=UTC)

Test Execution:
  yarn test                   # Unit tests (no E2E)
  yarn test:acceptance        # E2E/acceptance only
  yarn test --watch           # Watch mode
  yarn test --coverage        # With coverage report

Unit Test Files (15+):
  ✓ test-pin-tan-client.ts       - Client methods, fixtures
  ✓ test-client.ts               - Abstract client
  ✓ test-pin-tan-client-e2e.ts   - End-to-end integration
  ✓ test-client-holdings.ts      - Securities/holdings
  ✓ test-dialog.ts               - Session management
  ✓ test-parse.ts                - Parsing utilities
  ✓ test-pain.ts                 - PAIN.001 & PAIN.008 generation
  ✓ test-mt940-86-structured.ts  - Transaction reference parsing
  ✓ test-mt535.ts                - Holdings parsing
  ✓ test-tan-required-error.ts   - TAN error handling
  ✓ test-decoupled-tan-manager.ts - PSD2 async TAN
  ✓ test-error-codes.ts          - Error code mapping
  ✓ test-fints-error.ts          - Error classes
  ✓ test-utils.ts                - Utility functions
  ✓ test-return-value.ts         - Return value parsing
  [+1 more]

CLI Tests (2):
  ✓ get-balance.test.ts
  ✓ list-holdings.test.ts

Test Fixtures:
  Located in: src/__tests__/
  Format: JSON files with mock server responses
  Examples: fixture-accounts.json, fixture-statements.json

CI Pipeline (make or yarn):
  1. Build (tsc)
  2. Lint (eslint)
  3. Test (jest)
  
  GitHub Actions: Node 18 & 20, on push/PR


═══════════════════════════════════════════════════════════════════════════════

KEY STATISTICS:

Lines of Code (main src):
  • Total: ~3,671 lines
  • types.ts: 409 lines
  • client.ts: 409 lines (abstract + methods)
  • dialog.ts: 329 lines
  • pain.ts: 408 lines
  • Segments: 1,614 lines total

Classes/Interfaces:
  • Core Classes: 5 (Client, PinTanClient, Dialog, Request, Response)
  • Segment Implementations: 55+
  • Domain Interfaces: 40+
  • Type Definitions: 10+
  • Error Classes: 8+

Files & Modules:
  • Total TypeScript files: 100+
  • Main source files: 50+ (.ts)
  • Test files: 17+ (.test.ts)
  • Segment files: 55+

Dependencies (prod):
  • bind-decorator, date-fns, fast-xml-parser
  • iconv-lite (encoding), invariant, isomorphic-fetch
  • mt940-js (transaction parsing), winston (logging)

Development:
  • TypeScript 5.9.3, Jest 30.2.0, ts-jest, ESLint, Prettier
  • Lerna (monorepo), Lerna bootstrap

Publishing:
  • npm: fints-lib v0.8.0, fints-lib-cli v0.4.0
  • GitHub: larsdecker/fints
  • License: MIT

═══════════════════════════════════════════════════════════════════════════════
___BEGIN___COMMAND_DONE_MARKER___0
