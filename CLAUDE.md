# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A local emulator for Amazon Cognito authentication services. Provides **both** an OIDC/Hosted UI surface **and** a full AWS SDK-compatible API surface (`X-Amz-Target` header routing), running as a single Express server. Designed to be used as a Docker container for local development and testing against Cognito without hitting AWS.

As of `1.0.0-beta.0` the emulator covers ~110 Cognito SDK operations, all 9 Lambda trigger families, MFA / TOTP, multi-pool configuration, and the full OIDC / Hosted UI surface.

## Commands

- `npm run dev` — Start with hot reload (tsx watch)
- `npm run build` — Compile TypeScript (`tsc`)
- `npm test` — Run all tests (`vitest run`)
- `npm run test:watch` — Run tests in watch mode
- `npm run test:integration` — Run only the AWS SDK v3 integration tests
- `npx vitest run test/sdk/sign-up.test.ts` — Run a single test file
- `npm run lint` — ESLint on src/ and test/
- `npm run format` — Prettier on src/ and test/

## Architecture

### Two API Surfaces, One Server

The Express app (`src/index.ts`) mounts two routers in order:

1. **SDK Router** (`src/sdk/router.ts`) — Handles `POST /` with `X-Amz-Target: AWSCognitoIdentityProviderService.*` header. ~110 Cognito operations under `src/sdk/handlers/`. The router has a single try/catch funnel that maps `CognitoError` → JSON response with the right HTTP status. Unknown operations return `CognitoLocal#Unsupported` with the operation name (request body echoed in `COGNITO_LOCAL_DEVMODE=1`).

2. **OIDC Router** (`src/oidc/router.ts`) — Handles standard OIDC endpoints: `/.well-known/openid-configuration`, `/.well-known/jwks.json`, `/oauth2/authorize`, `/oauth2/token` (incl. `client_credentials` grant), `/oauth2/userInfo`, `/oauth2/revoke`, `/logout`, plus the ALB-style `GET /:kid` public-keys endpoint. Includes a server-rendered login page (`src/oidc/login-page.ts`).

SDK router must be mounted first since both handle `POST /`.

### AppContext

All routes receive an `AppContext` object:

```typescript
interface AppContext {
  config: AppConfig;         // multi-pool
  keys: KeyPair;
  logger: Logger;            // pino
  clock: Clock;              // injectable for tests
  userPoolStore: UserPoolStore;
  clientStore: ClientStore;
  tokenStore: TokenStore;
  groupStore: GroupStore;
  triggers: TriggerService;
}
```

This is the central dependency injection mechanism — no singletons or global state.

### Error model — `src/errors.ts`

`CognitoError` class hierarchy (`NotAuthorizedError`, `UserNotFoundError`, `UserNotConfirmedError`, `InvalidParameterError`, `CodeMismatchError`, `InvalidPasswordError`, `UnsupportedError`, etc.). Handlers `throw` these; the SDK router's funnel turns them into the right JSON response.

### Data Layer (`src/data/`)

- **UserPoolStore** — multi-pool CRUD for pools, users, sub/email/username alias resolution. Persists to `{dataDir}/pools.json` + `users.json`.
- **ClientStore** — clients keyed by `clientId`, with pool lookup. Persists to `clients.json`.
- **TokenStore** — auth codes (in-memory, 60s TTL), refresh tokens (persisted, supports revocation), sessions for `RespondToAuthChallenge` (in-memory, 5min TTL), revoked-token set (persisted).
- **GroupStore** — groups keyed by `${poolId}:${name}`.
- Niche entity stores (identity providers, resource servers, domains, devices, etc.) live inside their handler files and use the shared `DataStore<T>` JSON-file abstraction.

### Token Generation (`src/tokens/`)

- `claims.ts` — Builds Cognito-style JWT claims (`cognito:groups`, `cognito:username`, `token_use`, standard OIDC claims).
- `generate.ts` — Signs JWTs with the RSA key pair from `src/crypto.ts`. Supports `PreTokenGeneration` claim overrides (V1 — ID token only) and V2 (ID + access token).

### Lambda Triggers (`src/triggers/` and `src/services/lambda.ts`)

- `TriggerService.fromPools()` builds per-pool trigger maps.
- `TriggerInvoker` dispatches either to `HttpLambdaInvoker` (POSTs to a configured endpoint — works with serverless-offline) or `AwsLambdaInvoker` (uses `@aws-sdk/client-lambda` v3 with the default credential provider chain — honors `AWS_PROFILE`).
- 9 trigger families: `PreSignUp`, `PostConfirmation`, `PreAuthentication`, `PostAuthentication`, `PreTokenGeneration` (V1+V2), `UserMigration`, `CustomMessage`, `CustomEmailSender`, `CustomSMSSender`.

### Wire format

Internal types use `Date` and ISO strings. At the response boundary, the SDK router wraps `res.json` with the `cognitoJsonReplacer` (`src/util/json.ts`), which converts `Date` and ISO-string `*Date` fields to unix epoch seconds — the format the AWS SDK v3 expects.

### Config (`src/config.ts`)

Loads `config.json` (multi-pool schema) and `users.json` from paths specified by env vars (`CONFIG_FILE`, `USERS_FILE`). Old single-pool 0.x configs are detected and refused with a `ConfigMigrationError` pointing to the migration guide.

## Testing

Tests use **vitest** with **supertest** for HTTP assertions. `test/setup.ts` exports `createTestApp()` which creates an isolated app instance with a temp data directory, pre-seeded with two test users (one confirmed, one unconfirmed). Temp directories are cleaned up in `afterEach`.

Test constants: `TEST_POOL_ID`, `TEST_CLIENT_ID`, `TEST_CLIENT_SECRET`, `TEST_ISSUER_HOST` — all from `test/setup.ts`.

Test structure mirrors the source:
- `test/oidc/` — OIDC endpoints
- `test/sdk/` — SDK operations
- `test/integration/` — full auth flows, plus the AWS SDK v3 integration suite (`aws-sdk-v3.test.ts`) that runs against a live HTTP server using real `@aws-sdk/client-cognito-identity-provider` clients.

## Adding a New SDK Operation

1. Create handler in `src/sdk/handlers/{operation-name}.ts` — factory closing over `ctx`, body uses `throw new XxxError(...)` for failures.
2. Register it in `src/sdk/router.ts` under the matching `X-Amz-Target` value.
3. Add tests in `test/sdk/`.
4. If it introduces a new entity, add a typed entity in `src/types.ts` and use the shared `DataStore<T>` for persistence.

## Adding a New Lambda Trigger

1. Add the trigger to `PoolTriggerConfig` in `src/types.ts`.
2. Wire `ctx.triggers.fire(pool, name, event)` into the appropriate handler.
3. Build the event envelope via `triggerEvent({...})` from `src/triggers/index.ts`.
