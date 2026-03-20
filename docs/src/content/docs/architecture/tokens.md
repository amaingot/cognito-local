---
title: Token Generation
description: How cognito-local creates and structures JWTs, including access token and ID token claims, at_hash computation, and the token generation flow.
---

## Token Signing

All tokens are signed with RS256 (RSA + SHA-256) using the server's private key. The key ID (`kid`) is `"cognito-local-key-1"`. Clients can verify tokens using the public key available from the JWKS endpoint at `/.well-known/jwks.json`.

## Access Token Claims

Built by `buildAccessTokenClaims` in `src/tokens/claims.ts`.

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | string | User's username |
| `token_use` | string | Always `"access"` |
| `scope` | string | Space-separated scopes |
| `client_id` | string | The app client ID |
| `username` | string | User's username |
| `cognito:groups` | string[] | User's group memberships |
| `event_id` | string | Random UUID per authentication |
| `auth_time` | number | Unix timestamp of authentication |
| `iss` | string | Issuer URL (e.g., `http://localhost:9229/us-east-1_localDev01`) |
| `exp` | number | Expiration timestamp |
| `iat` | number | Issued-at timestamp |

## ID Token Claims

Built by `buildIdTokenClaims` in `src/tokens/claims.ts`.

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | string | User's username |
| `token_use` | string | Always `"id"` |
| `cognito:username` | string | User's username |
| `cognito:groups` | string[] | User's group memberships |
| `email` | string | User's email |
| `email_verified` | boolean | Whether email is verified |
| `auth_time` | number | Unix timestamp of authentication |
| `at_hash` | string | Access token hash (first half of SHA-256, base64url-encoded) |
| `iss` | string | Issuer URL |
| `aud` | string | The app client ID |
| `exp` | number | Expiration timestamp |
| `iat` | number | Issued-at timestamp |
| `nonce` | string | Included if provided in the authorization request |

### Profile Claims

Additional claims are included in the ID token if they are set in the user's attributes:

`given_name`, `family_name`, `name`, `nickname`, `phone_number`, `picture`, `locale`, `address`, `birthdate`, `gender`, `middle_name`, `preferred_username`, `profile`, `website`, `zoneinfo`

These follow the standard OIDC profile scope claims.

## at_hash Computation

The `at_hash` claim is computed per the OIDC specification:

1. Compute the SHA-256 hash of the ASCII representation of the access token.
2. Take the left-most half of the hash (first 128 bits).
3. Base64url-encode the result.

This allows relying parties to verify that the ID token and access token were issued together.

## Token Generation Flow

The full token generation process in `src/tokens/generate.ts` follows these steps:

1. Build access token claims from user data, client configuration, and scopes.
2. Sign the access token with RS256 using the server's private key.
3. Build ID token claims from user data and client configuration.
4. Compute `at_hash` from the signed access token string.
5. Sign the ID token with RS256 using the server's private key.
6. Return both signed tokens.

Both tokens use the same RSA key pair and the same `kid` value, so clients only need to fetch a single key from the JWKS endpoint for verification.
