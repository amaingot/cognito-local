---
title: Crypto & Key Management
description: How cognito-local generates, stores, and exports RSA keys for JWT signing and JWKS-based token verification.
---

## RSA Key Pair (`src/crypto.ts`)

On startup, the server either loads an existing key pair or generates a new one:

1. Check for `{dataDir}/keys.json`.
2. If the file exists, load the private key (PKCS8 PEM) and public key (SPKI PEM).
3. If not, generate a 2048-bit RSA key pair and save it to `keys.json`.

The key pair is stored as PEM-encoded strings:

```json
{
  "private": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "public": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
}
```

## JWK Export

The public key is exported as a JWK (JSON Web Key) for use by the JWKS endpoint at `/.well-known/jwks.json`. The exported JWK includes:

| Field | Value | Description |
|-------|-------|-------------|
| `kid` | `"cognito-local-key-1"` | Fixed key ID |
| `use` | `"sig"` | Signing use |
| `alg` | `"RS256"` | RSA with SHA-256 |
| `kty` | `"RSA"` | Key type |
| `n` | (base64url) | RSA modulus |
| `e` | (base64url) | RSA public exponent |

Clients and resource servers use this JWK to verify the signatures of access tokens and ID tokens issued by cognito-local.

## Key Persistence

The key pair is saved to the data directory (`{dataDir}/keys.json`). When running in Docker, mounting the data directory as a volume ensures the same keys are used across container restarts.

Without key persistence:

- New keys are generated on each startup.
- Previously issued tokens become unverifiable because the signing key has changed.
- Clients that cache the JWKS response will fail token verification until they refresh their cached keys.

For local development, the data directory defaults to `/temp-data` (or wherever the `DATA_DIR` environment variable points). As long as this directory is preserved between restarts, tokens remain valid.
