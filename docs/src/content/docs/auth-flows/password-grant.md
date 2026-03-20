---
title: "Password Grant (OIDC)"
description: "How to use the OAuth2 password grant via the OIDC token endpoint for quick testing with cognito-local."
---

The password grant is a convenient shortcut for testing. It allows you to exchange a username and password directly for tokens via the OIDC token endpoint, without the redirect-based authorization code flow.

## Overview

Send a `POST` request to `/oauth2/token` with:

- `grant_type=password`
- `username` -- the user's username or email
- `password` -- the user's password
- `scope` (optional) -- space-separated scopes such as `openid email profile`
- Client credentials via HTTP Basic auth or in the request body

## curl example

Using HTTP Basic authentication for client credentials:

```bash
curl -X POST http://localhost:9229/oauth2/token \
  -u "my-app-local:local-secret" \
  -d "grant_type=password" \
  -d "username=alice@example.com" \
  -d "password=Password1!" \
  -d "scope=openid email profile"
```

Alternatively, pass client credentials in the request body:

```bash
curl -X POST http://localhost:9229/oauth2/token \
  -d "grant_type=password" \
  -d "username=alice@example.com" \
  -d "password=Password1!" \
  -d "client_id=my-app-local" \
  -d "client_secret=local-secret" \
  -d "scope=openid email profile"
```

## Response

A successful response follows the standard OAuth2 token response format:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "id_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

## SDK API vs. OIDC token endpoint

The password grant response format differs from the SDK's `InitiateAuth` response. Here is a comparison:

| Field | OIDC token endpoint | SDK InitiateAuth |
|---|---|---|
| Access token | `access_token` | `AuthenticationResult.AccessToken` |
| ID token | `id_token` | `AuthenticationResult.IdToken` |
| Refresh token | `refresh_token` | `AuthenticationResult.RefreshToken` |
| Expiration | `expires_in` | `AuthenticationResult.ExpiresIn` |
| Token type | `token_type` | `AuthenticationResult.TokenType` |

The tokens themselves are identical JWTs regardless of which endpoint issued them. The only difference is the JSON envelope.

## When to use the password grant

The password grant is best suited for:

- **Automated tests** that need tokens quickly without browser interaction.
- **CLI tools** and scripts where redirect-based flows are impractical.
- **Quick manual testing** with curl or Postman.

For browser-based applications, use the [Authorization Code Flow with PKCE](/auth-flows/authorization-code-pkce/) instead.

## Error conditions

### Invalid credentials

```json
{
  "error": "invalid_grant",
  "error_description": "Incorrect username or password."
}
```

### Invalid client

If the client ID or secret is wrong:

```json
{
  "error": "invalid_client",
  "error_description": "Client authentication failed."
}
```
