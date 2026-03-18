# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A local emulator for Amazon Cognito authentication services. Provides both an OIDC/Hosted UI surface and an AWS SDK-compatible API surface (`X-Amz-Target` header routing), running as a single Express server. Designed to be used as a Docker container for local development and testing against Cognito without hitting AWS.

## Commands

- `npm run dev` — Start with hot reload (tsx watch)
- `npm run build` — Compile TypeScript (`tsc`)
- `npm test` — Run all tests (`vitest run`)
- `npm run test:watch` — Run tests in watch mode
- `npx vitest run test/sdk/sign-up.test.ts` — Run a single test file
- `npm run lint` — ESLint on src/ and test/
- `npm run format` — Prettier on src/ and test/

## Architecture

### Two API Surfaces, One Server

The Express app (`src/index.ts`) mounts two routers in order:

1. **SDK Router** (`src/sdk/router.ts`) — Handles `POST /` with `X-Amz-Target: AWSCognitoIdentityProviderService.*` header. Each Cognito operation (InitiateAuth, SignUp, AdminGetUser, etc.) has a handler in `src/sdk/handlers/`. The router dispatches based on the target header value.

2. **OIDC Router** (`src/oidc/router.ts`) — Handles standard OIDC endpoints: `/.well-known/openid-configuration`, `/.well-known/jwks.json`, `/oauth2/authorize`, `/oauth2/token`, `/oauth2/userInfo`, `/oauth2/revoke`, `/logout`. Includes a server-rendered login page (`src/oidc/login-page.ts`).

SDK router must be mounted first since both handle `POST /`.

### AppContext

All routes receive an `AppContext` object containing config, RSA keys, and the three stores. This is the central dependency injection mechanism — no singletons or global state.

### Data Layer (`src/data/`)

- **UserPoolStore** — CRUD for user pools and users. Persists to `{dataDir}/users.json`.
- **ClientStore** — CRUD for app clients. Persists to `{dataDir}/clients.json`.
- **TokenStore** — In-memory store for auth codes and refresh tokens (not persisted).

Stores are initialized from config at startup via `initFromConfig()`.

### Token Generation (`src/tokens/`)

- `claims.ts` — Builds Cognito-style JWT claims (`cognito:groups`, `cognito:username`, `token_use`)
- `generate.ts` — Signs JWTs with the RSA key pair from `src/crypto.ts`

### Config (`src/config.ts`)

Loads `config.json` and `users.json` from paths specified by env vars (`CONFIG_FILE`, `USERS_FILE`). Falls back to `config/config.example.json` and `config/users.example.json` for local development.

## Testing

Tests use **vitest** with **supertest** for HTTP assertions. `test/setup.ts` exports `createTestApp()` which creates an isolated app instance with a temp data directory, pre-seeded with two test users (one confirmed, one unconfirmed). Temp directories are cleaned up in `afterEach`.

Test constants: `TEST_POOL_ID`, `TEST_CLIENT_ID`, `TEST_CLIENT_SECRET`, `TEST_ISSUER_HOST` — all from `test/setup.ts`.

Test structure mirrors the source: `test/oidc/` for OIDC endpoints, `test/sdk/` for SDK operations, `test/integration/` for full auth flows.

## Adding a New SDK Operation

1. Create handler in `src/sdk/handlers/{operation-name}.ts`
2. Register it in `src/sdk/router.ts` with the `X-Amz-Target` value
3. Add tests in `test/sdk/`
