# Publishing This Project Under a New Name on npm

## Quick Overview

This is a **FinTS client library** for communicating with German banking servers. It's a monorepo containing two packages:
- `fints` - The main TypeScript library
- `fints-cli` - A command-line interface tool

## Steps to Publish Under a New Name

### 1. Update Package Names

**In `packages/fints/package.json`:**
```json
{
  "name": "your-new-package-name",
  "version": "1.0.0"
}
```

**In `packages/fints-cli/package.json`:**
```json
{
  "name": "your-new-package-name-cli",
  "version": "1.0.0",
  "dependencies": {
    "your-new-package-name": "^1.0.0"
  }
}
```

### 2. Update Repository Information

In both `package.json` files:
```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/your-repo-name"
  },
  "author": "Your Name",
  "contributors": [...]
}
```

### 3. Update Documentation

Update these files:
- `/README.md`
- `/packages/fints/README.md`
- `/packages/fints-cli/README.md`

Change:
- Package names
- npm badge URLs
- Installation commands
- Import examples
- Repository links

### 4. Build and Test

```bash
yarn install
make build
make test
make lint
```

### 5. Publish to npm

```bash
# Login to npm
npm login

# Check name availability
npm search your-new-package-name

# Publish with lerna (recommended)
yarn lerna publish

# Or manually
cd packages/fints && npm publish
cd ../fints-cli && npm publish
```

## New Features You Could Add

### Critical Improvements

1. **Fix node-gyp/node-expat issue**: Replace deprecated XML parsing dependencies
2. **Migrate from tslint to eslint**: tslint is deprecated
3. **Update outdated dependencies**: Many packages have security warnings
4. **ESM support**: Add native ES modules alongside CommonJS

### Extended Banking Features

- Standing orders management (create, modify, delete)
- Securities trading (buy/sell stocks)
- Credit card transactions
- Scheduled transfers
- Bulk transfers

### Better Developer Experience

- Complete TypeScript 5.x types
- Consistent async/await API
- Structured error classes
- Configurable logging levels
- Better documentation

### Enhanced Security

- Encrypted credential storage
- Hardware token support
- Audit logging
- Rate limiting

### Modern TAN Methods

- Improved pushTAN support
- photoTAN support
- FIDO2/WebAuthn integration

### CLI Improvements

- Interactive TUI mode
- Configuration profiles
- CSV/JSON/Excel export
- Automatic reports

### PSD2 & Open Banking

- Enhanced XS2A support
- Better consent management
- REST API wrapper
- OAuth2 integration

## Important Notes

### Legal Requirements

⚠️ **Registration Required**: Before using FinTS in production, you must register your application with "Die Deutsche Kreditwirtschaft" to obtain a registration number. This process can take several weeks.

### License

The original project is MIT licensed. When forking:
1. Keep the original license
2. Add your own copyright notices
3. Clearly document that this is a fork
4. Credit the original authors

## Build Commands

```bash
# Install dependencies
yarn install

# Build
make build

# Test
make test

# Lint
make lint

# Generate docs
make docs

# Clean
make clean

# Publish
make publish
```

## Resources

- **FinTS Specification**: https://www.hbci-zka.de/spec/3_0.htm
- **Bank Database**: https://github.com/jhermsmeier/fints-institute-db
- **MT940 Format**: https://en.wikipedia.org/wiki/MT940
- **Original Project**: https://github.com/Prior99/fints

## Current Features

- Load list of accounts
- Fetch account statements and transactions
- Get current balances
- List depot holdings
- Submit SEPA credit transfers (pain.001) with TAN handling
- Submit SEPA direct debits (pain.008) with TAN handling
- Parse MT940 statements
- Parse transaction descriptions
- Extract reference tags
- List supported TAN methods
- PSD2 support
