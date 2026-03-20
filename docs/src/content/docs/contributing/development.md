---
title: Development Setup
description: How to set up a local development environment for cognito-local, including prerequisites, available scripts, and project structure.
---

## Prerequisites

- Node.js 20 or later
- npm

## Getting Started

```bash
git clone https://github.com/amaingot/cognito-local.git
cd cognito-local
npm install
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the server with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled server from `dist/index.js` |
| `npm test` | Run all tests (vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint on `src/` and `test/` |
| `npm run format` | Run Prettier on `src/` and `test/` |

## Local Development

When running with `npm run dev`, the server uses config files from `config/config.example.json` and `config/users.example.json` as fallbacks if the default paths (`/config/config.json`, `/config/users.json`) do not exist.

Data is persisted to `/temp-data` by default (or wherever `DATA_DIR` points). For local development, you may want to set `DATA_DIR=./temp-data` to keep data in the project directory:

```bash
DATA_DIR=./temp-data npm run dev
```

## Project Structure

```
src/
  index.ts              # App creation and startup
  config.ts             # Configuration loading
  crypto.ts             # RSA key management
  types.ts              # TypeScript interfaces
  data/
    store.ts            # Generic DataStore base class
    user-pool-store.ts  # User pool and user storage
    client-store.ts     # App client storage
    token-store.ts      # Auth codes and refresh tokens
  oidc/
    router.ts           # OIDC endpoint routing
    discovery.ts        # .well-known endpoints
    jwks.ts             # JWKS endpoint
    authorize.ts        # Authorization + login page
    token.ts            # Token exchange
    userinfo.ts         # UserInfo endpoint
    logout.ts           # Logout
    revoke.ts           # Token revocation
    login-page.ts       # Login page HTML
  sdk/
    router.ts           # SDK operation routing
    errors.ts           # Error response helpers
    handlers/           # One file per SDK operation
  tokens/
    claims.ts           # JWT claim builders
    generate.ts         # Token signing
test/
  setup.ts              # Test utilities and app factory
  oidc/                 # OIDC endpoint tests
  sdk/                  # SDK operation tests
  integration/          # Full auth flow tests
config/
  config.example.json   # Example configuration
  users.example.json    # Example user seed data
```
