# Publishing to NPM

This document describes the process for publishing the `fints-lib` and `fints-lib-cli` packages to npm.

## Prerequisites

Before you can publish packages to npm, you need:

1. An npm account (create one at https://www.npmjs.com/signup)
2. An npm access token with publish permissions
3. The token stored as a GitHub secret named `NPM_TOKEN`

## Setting up NPM_TOKEN Secret

1. Generate an npm access token:
   - Go to https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click "Generate New Token"
   - Select "Automation" type
   - Copy the generated token

2. Add the token to GitHub secrets:
   - Go to your repository Settings
   - Navigate to "Secrets and variables" > "Actions"
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Paste your npm token
   - Click "Add secret"

## Publishing Methods

### Method 1: Automatic Publishing via GitHub Release

The recommended way to publish is through GitHub Releases:

1. Update the version in both package.json files:
   - `packages/fints/package.json`
   - `packages/fints-cli/package.json`

2. Commit and push the version changes

3. Create a new GitHub Release:
   - Go to the repository's Releases page
   - Click "Draft a new release"
   - Create a new tag (e.g., `v0.5.1`)
   - Add release notes describing the changes
   - Click "Publish release"

4. The GitHub Action will automatically:
   - Build both packages
   - Publish `fints-lib` to npm
   - Publish `fints-lib-cli` to npm

### Method 2: Manual Publishing via Workflow Dispatch

You can also trigger publishing manually:

1. Go to the "Actions" tab in GitHub
2. Select the "Publish to NPM" workflow
3. Click "Run workflow"
4. Choose which package to publish:
   - `all` - Publish both packages
   - `fints-lib` - Publish only the library
   - `fints-lib-cli` - Publish only the CLI
5. Click "Run workflow"

## Version Numbering

Follow semantic versioning (semver):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes

Example: `0.5.0` → `0.5.1` (patch) or `0.6.0` (minor) or `1.0.0` (major)

## Pre-Publishing Checklist

Before publishing, ensure:

- [ ] All tests pass (`yarn test` in both packages)
- [ ] Linting passes (`yarn lint` at root)
- [ ] Both packages build successfully (`yarn build` in both packages)
- [ ] Version numbers are updated in both package.json files
- [ ] CHANGELOG is updated (if exists)
- [ ] README files are up to date
- [ ] Dependencies are up to date

## Post-Publishing Verification

After publishing:

1. Verify packages on npm:
   - https://www.npmjs.com/package/fints-lib
   - https://www.npmjs.com/package/fints-lib-cli

2. Test installation:
   ```bash
   npm install fints-lib
   npm install -g fints-lib-cli
   ```

3. Verify the CLI works:
   ```bash
   fints-lib --help
   ```

## Troubleshooting

### Publishing Fails with "402 Payment Required"

This means you need to log in to npm. For GitHub Actions, ensure the `NPM_TOKEN` secret is set correctly.

### Publishing Fails with "403 Forbidden"

This can happen if:
- The package name is already taken (but not by you)
- You don't have permission to publish to the package
- Your npm token doesn't have publish permissions

### Version Already Exists

If a version is already published, you cannot republish it. You must increment the version number.

## Resources

- [npm Publishing Documentation](https://docs.npmjs.com/cli/v9/commands/npm-publish)
- [Semantic Versioning](https://semver.org/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
