---
title: Architecture Overview
description: High-level architecture of cognito-local, including the dual API surface design, dependency injection via AppContext, startup flow, and request routing.
---

## Single Server, Two API Surfaces

The Express app (`src/index.ts`) creates two routers that together provide full Cognito emulation:

1. **SDK Router** (`src/sdk/router.ts`) -- Handles `POST /` requests that include an `X-Amz-Target` header. Each Cognito API operation (such as `InitiateAuth`, `SignUp`, or `AdminGetUser`) has a dedicated handler in `src/sdk/handlers/`. The router dispatches to the correct handler based on the target header value.

2. **OIDC Router** (`src/oidc/router.ts`) -- Handles standard OIDC endpoints including `/.well-known/openid-configuration`, `/.well-known/jwks.json`, `/oauth2/authorize`, `/oauth2/token`, `/oauth2/userInfo`, `/oauth2/revoke`, and `/logout`. It also serves a server-rendered login page for the hosted UI flow.

The SDK router is mounted first because both routers handle `POST /`. The SDK router checks for the `X-Amz-Target` header and calls `next()` to pass through to the OIDC router if the header is absent.

## AppContext

All routes receive an `AppContext` object, which is the central dependency injection mechanism. No singletons or global state exist anywhere in the codebase. Each test creates an isolated `AppContext` with its own data directory.

The `AppContext` contains:

| Property | Type | Purpose |
|----------|------|---------|
| `config` | `AppConfig` | Loaded and merged configuration |
| `keys` | `KeyPair` | RSA signing keys (private and public) |
| `userPoolStore` | `UserPoolStore` | User pool and user CRUD operations |
| `clientStore` | `ClientStore` | App client CRUD operations |
| `tokenStore` | `TokenStore` | Auth codes and refresh tokens |

## Startup Flow

The server follows this sequence on startup:

1. `loadConfig()` reads `config.json` and environment variables, merging them with defaults.
2. `loadUsers()` reads `users.json` for pre-configured user data.
3. `loadOrGenerateKeys()` loads an existing RSA key pair from the data directory or generates a new one.
4. Stores are initialized: `UserPoolStore`, `ClientStore`, and `TokenStore`.
5. `initFromConfig()` seeds the default user pool, clients, and users. This is idempotent -- it only creates entries that do not already exist.
6. The Express app is created with CORS middleware, the SDK router, and the OIDC router.
7. The server begins listening on the configured port.

## Request Flow

```
Client Request
  -> Express (CORS middleware)
  -> SDK Router (checks X-Amz-Target header)
    -> If SDK request: dispatch to handler
    -> If not: call next()
  -> OIDC Router (matches URL path)
    -> Handle OIDC endpoint
```

When a request arrives, Express first applies CORS middleware. The SDK router then inspects the request: if the `X-Amz-Target` header is present and matches a known operation, it dispatches to the corresponding handler. If the header is missing or unrecognized, the request falls through to the OIDC router, which matches against its defined URL paths.

This layered approach allows a single `POST /` endpoint to serve both the AWS SDK protocol (header-based routing) and the OIDC token endpoint (path-based routing) without conflict.
