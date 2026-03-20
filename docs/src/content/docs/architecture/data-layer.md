---
title: Data Layer
description: How cognito-local stores user pools, clients, and tokens using a generic DataStore base class with JSON file persistence.
---

The data layer consists of three stores, each built on a generic `DataStore<T>` base class that provides in-memory storage with automatic JSON file persistence.

## DataStore (`src/data/store.ts`)

A generic key-value store backed by an in-memory `Map<string, T>` with JSON file persistence.

**Core operations:**

- `get(key)`, `set(key, value)`, `delete(key)`, `has(key)` -- standard map operations
- `values()`, `entries()`, `size()`, `clear()` -- iteration and management
- Every write operation (`set`, `delete`, `clear`) triggers an immediate `persist()` call

**Persistence behavior:**

- Data is written to `{dataDir}/{fileName}` as pretty-printed JSON
- On construction, existing data is loaded from disk if the file exists
- If the file is corrupted or unreadable, the store starts fresh with an empty state

## UserPoolStore (`src/data/user-pool-store.ts`)

Manages user pools and users via two separate `DataStore` instances:

- `pools.json` -- keyed by pool ID
- `users.json` -- keyed by `{poolId}:{username}`

**Key methods:**

| Method | Description |
|--------|-------------|
| `getUser(poolId, username)` | Exact username lookup |
| `getUserByEmail(poolId, email)` | Scan by email (case-insensitive) |
| `listUsers(poolId, filter?)` | List users with optional attribute filter (`attribute = "value"`) |
| `generateUsername()` | Returns a UUIDv4 |
| `generateConfirmationCode()` | Returns a random 6-digit string |

**Initialization:**

`initFromConfig()` creates the default pool and seeds users only if they do not already exist. This makes the initialization idempotent -- restarting the server does not overwrite existing data.

## ClientStore (`src/data/client-store.ts`)

Manages app clients with a single `DataStore` instance:

- `clients.json` -- keyed by client ID

**Key methods:**

| Method | Description |
|--------|-------------|
| `getClient(clientId)` | Look up a client by ID |
| `getClientsByPool(poolId)` | List all clients for a user pool |
| `createClient()` | Create a new app client |
| `deleteClient()` | Remove an app client |

**Initialization:**

`initFromConfig()` seeds clients from the configuration file. Like `UserPoolStore`, this is idempotent.

## TokenStore (`src/data/token-store.ts`)

Manages authorization codes and refresh tokens with two `DataStore` instances:

- `auth-codes.json` -- authorization codes (short-lived, 2-minute expiry)
- `refresh-tokens.json` -- refresh tokens (configurable expiry)

**Key behaviors:**

| Behavior | Description |
|----------|-------------|
| Single-use auth codes | `consumeAuthCode()` reads and deletes the code atomically |
| Automatic cleanup | A timer runs every 60 seconds to purge expired auth codes |
| User token revocation | `revokeUserTokens(userId)` revokes all refresh tokens for a user |
| Cleanup on shutdown | `destroy()` clears the cleanup timer (important for test cleanup) |

Authorization codes are designed to be consumed exactly once. The `consumeAuthCode()` method returns the associated data and immediately deletes the code from the store. If the code has already been consumed or has expired, the method returns `undefined`.

The `revokeUserTokens()` method is used by operations like `AdminDeleteUser` to invalidate all of a user's active refresh tokens when their account is removed.
