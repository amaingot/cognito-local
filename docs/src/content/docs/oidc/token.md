---
title: Token Exchange
description: Exchange authorization codes, passwords, or refresh tokens for access and ID tokens.
---

## POST /oauth2/token

Exchanges authorization codes, passwords, or refresh tokens for access/ID tokens.

Content-Type: `application/x-www-form-urlencoded`

### Client Authentication

The client can authenticate via:

1. **HTTP Basic auth:** `Authorization: Basic base64(client_id:client_secret)`
2. **POST body:** `client_id` and `client_secret` as form parameters

Public clients (no secret configured) only need to provide `client_id`.

## Authorization Code Grant

`grant_type=authorization_code`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `grant_type` | Yes | `authorization_code` |
| `code` | Yes | The authorization code from the authorize redirect |
| `redirect_uri` | No | Must match the redirect_uri used in the authorize request |
| `code_verifier` | Conditional | Required if `code_challenge` was sent in the authorize request (PKCE) |

### Example

```bash
curl -X POST http://localhost:9229/oauth2/token \
  -d "grant_type=authorization_code" \
  -d "code=YOUR_AUTH_CODE" \
  -d "redirect_uri=http://localhost:3000/callback" \
  -d "client_id=my-app-local" \
  -d "client_secret=local-secret"
```

### PKCE Verification

If a `code_challenge` was provided during authorization, the token endpoint verifies that `SHA256(code_verifier) == code_challenge` using base64url encoding.

## Password Grant

`grant_type=password`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `grant_type` | Yes | `password` |
| `username` | Yes | User's email address |
| `password` | Yes | User's password |
| `scope` | No | Space-separated scopes (default: `openid`) |

### Example

```bash
curl -X POST http://localhost:9229/oauth2/token \
  -u "my-app-local:local-secret" \
  -d "grant_type=password" \
  -d "username=alice@example.com" \
  -d "password=Password1!" \
  -d "scope=openid email profile"
```

This is convenient for testing but not recommended for production OIDC flows.

## Refresh Token Grant

`grant_type=refresh_token`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `grant_type` | Yes | `refresh_token` |
| `refresh_token` | Yes | A valid refresh token |
| `scope` | No | Space-separated scopes (default: `openid`) |

## Success Response

All grant types return the same response shape:

```json
{
  "access_token": "eyJ...",
  "id_token": "eyJ...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "openid email profile"
}
```

## Error Responses

| Error | HTTP Status | Description |
|-------|-------------|-------------|
| `invalid_request` | 400 | Missing required parameter |
| `invalid_client` | 400/401 | Unknown client or wrong secret |
| `invalid_grant` | 400 | Invalid code, expired code, PKCE mismatch, or bad credentials |
| `unsupported_grant_type` | 400 | Unsupported grant type |
