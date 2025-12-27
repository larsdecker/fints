# Security Policy

## Supported Versions

We actively maintain and provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.6.x   | :white_check_mark: |
| < 0.6   | :x:                |

## Security Features

This library implements several security features to protect sensitive financial data:

### 1. Credential Masking in Logs

PINs and TANs are automatically masked in debug output to prevent accidental exposure in logs:
- Debug logging masks all credentials with `***MASKED***`
- Request serialization for transmission still contains actual credentials (required for authentication)
- Never log the raw request object or configuration containing credentials

### 2. Secure Dependencies

We regularly update dependencies and have replaced potentially insecure libraries:
- **yaml** instead of yamljs (more secure, actively maintained)
- All dependencies are regularly audited for known vulnerabilities
- TypeScript and build tools kept up-to-date

### 3. HTTPS Enforcement

Always use HTTPS URLs for FinTS endpoints to ensure:
- Encrypted communication
- Server authentication
- Protection against man-in-the-middle attacks

## Best Practices for Users

### 1. Credential Management

**DO:**
- Store credentials in environment variables or secure vaults
- Use secret management services (AWS Secrets Manager, Azure Key Vault, etc.)
- Rotate credentials regularly
- Use unique credentials per application

**DON'T:**
- Hardcode credentials in source code
- Commit credentials to version control
- Log credentials or configuration objects containing credentials
- Share credentials across multiple applications

### 2. Debug Mode

The `debug` option should be used cautiously:
- **Development**: Can be enabled for troubleshooting
- **Production**: Should always be disabled
- Debug logs may contain detailed request/response information

```typescript
// Production configuration
const client = new PinTanClient({
    url: process.env.FINTS_URL,
    name: process.env.FINTS_USERNAME,
    pin: process.env.FINTS_PIN,
    blz: process.env.FINTS_BLZ,
    debug: false, // Always false in production
});
```

### 3. Connection Security

- Only connect to official bank FinTS endpoints
- Verify SSL/TLS certificates are valid
- Use the official [FinTS institute database](https://github.com/jhermsmeier/fints-institute-db) to find correct URLs

### 4. Error Handling

Handle errors carefully to avoid leaking sensitive information:

```typescript
try {
    const accounts = await client.accounts();
} catch (error) {
    // ❌ Don't log the full error which might contain request details
    console.error("Full error:", error);
    
    // ✅ Log only safe error information
    console.error("Failed to fetch accounts:", error.message);
}
```

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please follow these steps:

### 1. **DO NOT** open a public issue

Public disclosure of security vulnerabilities before a fix is available puts all users at risk.

### 2. Report Privately

Report vulnerabilities privately using one of these methods:
- Create a security advisory through GitHub's Security tab
- Or contact the maintainers through other private channels

### 3. Include Details

Please provide:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if available)

### 4. Response Timeline

We aim to:
- Acknowledge receipt within 48 hours
- Provide an initial assessment within 1 week
- Release a fix as quickly as possible (depends on severity)
- Credit reporters (unless anonymity is requested)

## Security Updates

Security updates are released as:
- Patch versions for minor fixes (e.g., 0.6.1)
- Minor versions for larger changes (e.g., 0.7.0)

We recommend:
- Subscribe to repository notifications
- Regularly update to the latest version
- Review release notes for security-related changes

## Responsible Disclosure

We follow responsible disclosure practices:
1. Security issues are fixed privately
2. A patch is prepared and tested
3. A security advisory is published
4. The fix is released
5. Full details are disclosed after users have had time to update

Thank you for helping keep this library and its users secure!
