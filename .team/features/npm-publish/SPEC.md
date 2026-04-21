# Feature: npm publish

## Goal
Unblock automated publishing to the npm registry by configuring an npm Automation token as a GitHub Actions secret, enabling version tags to trigger a successful `npm publish` without manual 2FA intervention.

## Scope
- Create an npm Automation token on npmjs.com for the `@mengmikeli/agentic-team` package (Automation tokens bypass 2FA in CI environments)
- Set the token as `NPM_TOKEN` in the GitHub repository's Actions secrets
- Verify the existing `.github/workflows/publish.yml` workflow is correct (triggers on `v*` tags, uses `--access public --provenance`, has `id-token: write` permission)
- Fix any issues found in `publish.yml` (e.g. missing `--access public` for scoped packages, provenance config)
- Smoke-test by pushing a version tag and confirming the package appears on the npm registry

## Out of Scope
- Changing the npm package name, scope, or version strategy
- Adding a release notes / changelog generation step
- Setting up semantic-release or automated version bumping
- Publishing a dry-run CLI for local testing
- Any changes to package contents, files array, or bin scripts

## Done When
- [ ] An npm Automation token is created and stored as `NPM_TOKEN` in GitHub repository secrets
- [ ] `.github/workflows/publish.yml` runs to completion (green) when a `v*` tag is pushed
- [ ] The package `@mengmikeli/agentic-team@2.1.0` (or the current version at time of publish) is visible on https://www.npmjs.com/package/@mengmikeli/agentic-team
- [ ] The published package includes provenance attestation (verifiable via `npm audit signatures`)
- [ ] No manual 2FA prompt is required during the publish step
