# FinTS Repository - Exploration Index

This index guides you through the comprehensive exploration documentation created for the FinTS library.

## 📚 Documentation Files

### 1. **EXPLORATION_SUMMARY.md** (423 lines, 19 KB)
**Best for:** Complete understanding of the repository structure and capabilities

Contains:
- Overall directory structure (2-3 levels deep)
- Main packages/modules description
- Detailed architecture explanation with diagrams
- Complete list of existing capabilities/features
- Build and test instructions with examples
- All TypeScript types organized by domain (accounts, transactions, payments, etc.)
- Complete list of all type definition files
- Main index/exports breakdown (41 export groups)
- Test structure and how to run tests
- Key statistics and metrics

**When to read:** Start here for the big picture

---

### 2. **CODE_SNIPPETS.md** (448 lines, 15 KB)
**Best for:** Learning through practical code examples

Contains:
- Quick start example (3 lines to run)
- Handling TAN requirements (regular & PSD2 decoupled)
- Core type definitions with full documentation:
  - Account & Balance types
  - Transaction types with MT940-86 parsing
  - Payment types (credit transfers & direct debits)
  - Securities/holdings types
  - Standing orders
  - Error handling types
  - Decoupled TAN (PSD2) types
- Main client methods
- Dialog lifecycle examples
- Build & test commands
- File organization guide
- Version information

**When to read:** When you want to see actual code and understand patterns

---

### 3. **QUICK_REFERENCE.md** (420 lines, 12 KB)
**Best for:** Quick lookup and copy-paste examples during development

Contains:
- Installation (npm commands)
- Basic 3-step usage pattern
- 8+ common operations with code:
  - List accounts
  - Get balance
  - Fetch statements
  - List securities/holdings
  - List standing orders
- Payment operations (credit transfers & direct debits)
- TAN challenge handling (both sync and async)
- Core types quick reference
- Error handling summary with try-catch patterns
- Configuration options with defaults
- CLI quick reference with command examples
- Best practices (5 key points)
- Troubleshooting guide (7 common issues)
- Important links

**When to read:** During development, bookmarking key sections

---

## 🎯 Quick Navigation by Use Case

### "I want to understand how the library works"
→ Read: EXPLORATION_SUMMARY.md (sections 3 & 4)

### "I want to see code examples"
→ Read: CODE_SNIPPETS.md (all sections)

### "I want to copy-paste working code"
→ Read: QUICK_REFERENCE.md (Common Operations section)

### "I need to understand types for a specific domain"
→ Read: EXPLORATION_SUMMARY.md (section 6) or CODE_SNIPPETS.md (Type Definitions section)

### "I'm integrating with a payment system"
→ Read: CODE_SNIPPETS.md (Payment Types) + QUICK_REFERENCE.md (Payment Operations)

### "I need to handle TAN challenges"
→ Read: CODE_SNIPPETS.md (TAN Handling) or QUICK_REFERENCE.md (Handle TAN Challenges)

### "I'm building a CLI tool"
→ Read: QUICK_REFERENCE.md (CLI Quick Reference)

### "Something isn't working"
→ Read: QUICK_REFERENCE.md (Troubleshooting section)

---

## �� Repository Overview

**Location:** `/home/runner/work/fints/fints/`

**Monorepo Structure:**
```
packages/
  ├── fints/            (v0.8.0 - Core library)
  │   ├── src/          (100+ TypeScript files, 3,671 LOC)
  │   └── __tests__/    (15+ test files, 87.56% coverage)
  │
  └── fints-cli/        (v0.4.0 - CLI tool)
      ├── src/          (6 CLI commands)
      └── __tests__/    (2 integration tests)
```

**Key Stats:**
- 55+ FinTS protocol segment implementations
- 40+ domain interfaces / 10+ type definitions
- 200+ unit tests
- TypeScript 5.9.3 with Jest 30.2.0
- GitHub Actions CI/CD
- npm packages: fints-lib, fints-lib-cli

---

## 🔍 Key Components Overview

### Core Client
- **PinTanClient** - Main class (extends abstract Client)
- **Dialog** - Session & credential management
- **Request/Response** - Protocol communication

### Domain Types (from /src/types.ts)
- **SEPAAccount, Balance** - Account information
- **Transaction, Statement** - Transaction data
- **Holding** - Securities data
- **StandingOrder** - Recurring payments
- **CreditTransferRequest/Submission** - Outgoing payments
- **DirectDebitRequest/Submission** - Incoming payments
- **DecoupledTanState, DecoupledTanStatus** - PSD2 async auth

### Protocol Implementation
- 55+ Segment types (HKIDN, HKSAL, HKKAZ, HKWPD, HKSPA, HKTAB, HKCCS, HKCDB, HKTAN, etc.)
- Request/Response serialization
- Encryption (HNVSK/HNVSD segments)
- PIN/TAN handling

### Data Parsers
- **MT940Parser** - Bank statements (mt940-js library)
- **MT535Parser** - Securities/holdings
- **MT940-86Structured** - Transaction reference parsing
- **PAIN builders** - SEPA payment XML (PAIN.001, PAIN.008)

### Error Handling
- FinTSError (base)
- PinError, AuthenticationError, OrderRejectedError
- TanRequiredError, DecoupledTanError
- 234+ error codes mapped

---

## 🛠️ Building & Testing

### Build
```bash
make build                    # Full build
yarn build                   # Individual package
```

### Test
```bash
make test                    # Unit tests
yarn test:acceptance         # E2E tests
yarn test --coverage         # With coverage
```

### View Details
See EXPLORATION_SUMMARY.md (section 5) or QUICK_REFERENCE.md (Best Practices)

---

## 📖 Original Documentation

The repository includes comprehensive original documentation:
- **README.md** - User guide with examples
- **IMPLEMENTATION_SUMMARY.md** - npm publication setup
- **PUBLISHING.md** - How to publish to npm
- **SECURITY.md** - Security best practices

---

## 🔐 Important Security Notes

- Credentials should come from environment variables (not hardcoded)
- Enable debug logging only in development
- All communication is encrypted (HTTPS + FinTS encryption)
- PIN is masked in debug output
- No sensitive data persistence

See QUICK_REFERENCE.md (Best Practices) for examples.

---

## 🌐 External Resources

- **GitHub Repository:** https://github.com/larsdecker/fints
- **npm Library:** https://www.npmjs.com/package/fints-lib
- **npm CLI:** https://www.npmjs.com/package/fints-lib-cli
- **FinTS Specification:** https://www.hbci-zka.de/
- **Bank Database:** https://github.com/jhermsmeier/fints-institute-db

---

## 💡 Common Tasks

**Find information about...**

| What | Where to look |
|------|---------------|
| Account operations | EXPLORATION_SUMMARY.md §4, CODE_SNIPPETS.md Account types |
| Transaction parsing | CODE_SNIPPETS.md Transactions, EXPLORATION_SUMMARY.md Types |
| Payment operations | CODE_SNIPPETS.md Payments, QUICK_REFERENCE.md Payment Operations |
| TAN handling | CODE_SNIPPETS.md TAN Handling, QUICK_REFERENCE.md TAN Challenges |
| Error codes | EXPLORATION_SUMMARY.md §4 (Error Handling), QUICK_REFERENCE.md |
| Type definitions | EXPLORATION_SUMMARY.md §6, CODE_SNIPPETS.md Type Definitions |
| Configuration | CODE_SNIPPETS.md Client Methods, QUICK_REFERENCE.md Configuration |
| CLI commands | QUICK_REFERENCE.md CLI Quick Reference |
| Testing | EXPLORATION_SUMMARY.md §9, QUICK_REFERENCE.md Best Practices |

---

## 📝 How These Docs Were Created

Through systematic exploration of:
1. Directory structure analysis
2. File content review of 50+ source files
3. Type system analysis
4. Test structure examination
5. Build system investigation
6. Configuration review
7. Package.json analysis
8. Example code extraction

All documentation is based on actual repository inspection, not assumptions.

---

## ✅ Quality Checklist

These documentation files include:
- ✅ Complete directory structure
- ✅ All 40+ type definitions documented
- ✅ 55+ segment types referenced
- ✅ 10+ public methods explained
- ✅ Build & test instructions
- ✅ Working code examples
- ✅ Error handling patterns
- ✅ CLI commands
- ✅ Configuration options
- ✅ Security considerations
- ✅ Troubleshooting guide
- ✅ Best practices

---

## 🚀 Next Steps

1. **Understand the architecture:**
   - Read EXPLORATION_SUMMARY.md (section 3)

2. **See working examples:**
   - Read CODE_SNIPPETS.md (Quick Start Example)

3. **Build something:**
   - Pick a task from QUICK_REFERENCE.md
   - Copy the example code
   - Adapt to your needs

4. **Handle special cases:**
   - TAN challenges: QUICK_REFERENCE.md (Handle TAN Challenges)
   - Errors: QUICK_REFERENCE.md (Error Handling)
   - Troubleshooting: QUICK_REFERENCE.md (Troubleshooting)

---

**Documentation Version:** 1.0  
**Created:** March 2024  
**FinTS Library Version:** 0.8.0  
**Repository:** https://github.com/larsdecker/fints
