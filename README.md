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

```typescript
import { PinTanClient } from "fints-lib";

const client = new PinTanClient({
    url: "https://example.com/fints",
    name: "username",
    pin: "12345",
    blz: "12345678",
});

// List accounts
const accounts = await client.accounts();
console.log(accounts);

// Fetch statements
const startDate = new Date("2024-01-01");
const endDate = new Date("2024-12-31");
const statements = await client.statements(accounts[0], startDate, endDate);
console.log(statements);
```

For CLI usage:

```bash
# List accounts
fints-lib list-accounts --url https://example.com/fints -n username -p 12345 -b 12345678

# Fetch transactions
fints-lib fetch-transactions --url https://example.com/fints -n username -p 12345 -b 12345678 -i DE111234567800000001 -s 2024-01-01 -e 2024-12-31
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

If you discover a security vulnerability, please email the maintainers directly instead of opening a public issue.

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
