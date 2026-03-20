---
title: Client Settings
description: Detailed reference for configuring app clients in the cognito-local clients array.
---

The `clients` array in [config.json](../config-file/) defines the app clients registered with the user pool. Each client object represents an application that can authenticate users through cognito-local.

## Schema

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `clientId` | string | Yes | -- | Unique client identifier |
| `clientSecret` | string | No | -- | Client secret for confidential clients |
| `clientName` | string | Yes | -- | Display name |
| `callbackUrls` | string[] | No | `["http://localhost:3000/callback"]` | Allowed redirect URIs for OAuth flows |
| `logoutUrls` | string[] | No | `["http://localhost:3000"]` | Allowed post-logout redirect URIs |
| `explicitAuthFlows` | string[] | No | `["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]` | Allowed SDK auth flows |
| `allowedOAuthFlows` | string[] | No | `["code"]` | Allowed OAuth grant types |
| `allowedOAuthScopes` | string[] | No | `["openid", "email", "profile"]` | Allowed OAuth scopes |
| `accessTokenValidity` | number | No | `3600` | Access token lifetime in seconds (1 hour) |
| `idTokenValidity` | number | No | `3600` | ID token lifetime in seconds (1 hour) |
| `refreshTokenValidity` | number | No | `2592000` | Refresh token lifetime in seconds (30 days) |

Only `clientId` and `clientName` are required. All other fields have sensible defaults for local development.

## Public vs. confidential clients

cognito-local supports both public and confidential clients:

- **Public clients** do not have a `clientSecret`. These are appropriate for single-page applications (SPAs) and mobile apps where the secret cannot be kept safe. No secret is required in token requests.
- **Confidential clients** have a `clientSecret` set. When a client has a secret, it must be provided in token requests -- either via the HTTP Basic `Authorization` header (`base64(clientId:clientSecret)`) or as a `client_secret` body parameter.

## Callback and logout URLs

The `callbackUrls` array lists the redirect URIs that are accepted during the OAuth authorization flow. When a user completes login through the hosted UI, the server validates the `redirect_uri` parameter against this list. Requests with an unregistered redirect URI are rejected.

Similarly, `logoutUrls` lists the URIs that are accepted as the `logout_uri` parameter during logout. The server validates the redirect target against this list before redirecting.

## Auth flows

The `explicitAuthFlows` array controls which SDK authentication flows the client accepts. Common values include:

- `ALLOW_USER_PASSWORD_AUTH` -- Username/password authentication via the `InitiateAuth` SDK call
- `ALLOW_REFRESH_TOKEN_AUTH` -- Token refresh via the `InitiateAuth` SDK call
- `ALLOW_USER_SRP_AUTH` -- SRP-based authentication (if supported)
- `ALLOW_ADMIN_USER_PASSWORD_AUTH` -- Admin-initiated username/password authentication

## OAuth flows and scopes

The `allowedOAuthFlows` array specifies which OAuth grant types the client supports:

- `code` -- Authorization code grant (recommended for most use cases)
- `implicit` -- Implicit grant (for legacy SPAs)

The `allowedOAuthScopes` array specifies which scopes the client can request:

- `openid` -- Required for OIDC; includes the `sub` claim
- `email` -- Includes `email` and `email_verified` claims
- `profile` -- Includes name-related claims (`given_name`, `family_name`, `nickname`, etc.)

## Token validity

Token lifetimes are configured in seconds:

- `accessTokenValidity` -- How long access tokens remain valid (default: 3600 seconds / 1 hour)
- `idTokenValidity` -- How long ID tokens remain valid (default: 3600 seconds / 1 hour)
- `refreshTokenValidity` -- How long refresh tokens remain valid (default: 2592000 seconds / 30 days)

## Examples

### Minimal public client (SPA)

A public client with no secret, using all defaults:

```json
{
  "clients": [
    {
      "clientId": "spa-client",
      "clientName": "My SPA"
    }
  ]
}
```

This client will use the default callback URL (`http://localhost:3000/callback`), default logout URL (`http://localhost:3000`), authorization code flow, and standard OIDC scopes.

### Confidential client with full configuration

A confidential client with explicit settings for all fields:

```json
{
  "clients": [
    {
      "clientId": "backend-app",
      "clientSecret": "my-secret-value",
      "clientName": "Backend Service",
      "callbackUrls": [
        "http://localhost:4000/auth/callback",
        "http://localhost:4000/auth/callback-alt"
      ],
      "logoutUrls": [
        "http://localhost:4000",
        "http://localhost:4000/signed-out"
      ],
      "explicitAuthFlows": [
        "ALLOW_USER_PASSWORD_AUTH",
        "ALLOW_REFRESH_TOKEN_AUTH",
        "ALLOW_ADMIN_USER_PASSWORD_AUTH"
      ],
      "allowedOAuthFlows": ["code"],
      "allowedOAuthScopes": ["openid", "email", "profile"],
      "accessTokenValidity": 1800,
      "idTokenValidity": 1800,
      "refreshTokenValidity": 604800
    }
  ]
}
```

This client requires a secret for token requests, accepts three SDK auth flows, uses 30-minute access/ID tokens, and 7-day refresh tokens.

### Multiple clients

You can define multiple clients in the same config file. Each client operates independently with its own settings:

```json
{
  "clients": [
    {
      "clientId": "frontend-spa",
      "clientName": "Frontend App",
      "callbackUrls": ["http://localhost:3000/callback"]
    },
    {
      "clientId": "backend-api",
      "clientSecret": "api-secret",
      "clientName": "Backend API",
      "callbackUrls": ["http://localhost:4000/callback"],
      "accessTokenValidity": 900
    }
  ]
}
```
