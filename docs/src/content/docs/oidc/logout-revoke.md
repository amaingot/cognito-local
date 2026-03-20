---
title: Logout & Token Revocation
description: End user sessions and revoke refresh tokens.
---

## GET /logout

Ends the user session and optionally redirects. Supports both standard OIDC and Cognito-style parameters.

### OIDC-Style Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `post_logout_redirect_uri` | No | URI to redirect to after logout |
| `state` | No | Opaque value passed through to the redirect |

### Cognito-Style Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `logout_uri` | No | URI to redirect to after logout |
| `client_id` | No | If provided, only that client's logout URIs are checked |

If no redirect URI is provided, a simple "Logged out" HTML page is shown.

The redirect URI must match one of the `logoutUrls` configured for the client. If `client_id` is provided, only that client's logout URLs are checked; otherwise, all clients in the pool are checked.

### Examples

```bash
# OIDC-style
curl "http://localhost:9229/logout?post_logout_redirect_uri=http://localhost:3000&state=abc"

# Cognito-style
curl "http://localhost:9229/logout?client_id=my-app-local&logout_uri=http://localhost:3000"
```

## POST /oauth2/revoke

Revokes a refresh token.

Content-Type: `application/x-www-form-urlencoded`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `token` | Yes | The refresh token to revoke |

### Example

```bash
curl -X POST http://localhost:9229/oauth2/revoke \
  -d "token=YOUR_REFRESH_TOKEN"
```

Always returns `200 {}` regardless of whether the token was valid (per RFC 7009).
