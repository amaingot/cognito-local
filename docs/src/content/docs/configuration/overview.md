---
title: Configuration Overview
description: How cognito-local loads and merges configuration from environment variables, JSON files, and built-in defaults.
---

cognito-local uses a layered configuration system. Values are resolved in the following order of precedence (highest first):

1. **Environment variables** -- always take highest precedence
2. **JSON config file** values
3. **Built-in defaults**

This means an environment variable like `PORT=8080` will override a `"port": 9229` value in your config file, which in turn overrides the built-in default of `9229`.

## Configuration files

The server loads two JSON files at startup:

| File | Env var | Default path | Purpose |
|------|---------|--------------|---------|
| Config file | `CONFIG_FILE` | `/config/config.json` | Server settings, user pool, and client definitions |
| Users file | `USERS_FILE` | `/config/users.json` | Seed users to create on startup |

If neither file exists at the configured path, the server starts with built-in defaults and no pre-seeded users. For local development (outside Docker), the server falls back to `config/config.example.json` and `config/users.example.json` if the default paths are not found.

## Environment variable overrides

Two environment variables directly override values from the config file:

- `PORT` -- overrides the `port` field in config.json
- `DATA_DIR` -- overrides the `dataDir` field in config.json

See [Environment Variables](/configuration/environment-variables/) for the full list.

## Issuer host auto-generation

The `issuerHost` field controls the base URL used in OIDC discovery and JWT `iss` claims. If it is not explicitly set in config.json (or is set to an empty string), it is automatically generated as:

```
http://localhost:{port}
```

where `{port}` is the resolved port value after applying all overrides.

## Configuration flow

The full resolution order at startup is:

1. Read `CONFIG_FILE` env var to locate the config JSON file (default: `/config/config.json`)
2. Parse the config file if it exists; otherwise use an empty object
3. Merge built-in defaults with config file values
4. Apply `PORT` env var override (if set)
5. Apply `DATA_DIR` env var override (if set)
6. Auto-generate `issuerHost` if not explicitly configured
7. Read `USERS_FILE` env var to locate the users JSON file (default: `/config/users.json`)
8. Parse and seed users into the data store (skipping any that already exist)
