---
title: Authorization Endpoint
description: The authorization endpoint renders a login page and issues authorization codes for the OIDC Authorization Code flow.
---

## GET /oauth2/authorize

Renders a login page that displays all users in the pool as clickable cards. This replaces Cognito's Hosted UI login form.

### Query Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `client_id` | Yes | The app client ID |
| `redirect_uri` | No | Must match one of the client's configured `callbackUrls`. Falls back to first callback URL. |
| `response_type` | No | Only `code` is supported |
| `scope` | No | Space-separated scopes (default: `openid`) |
| `state` | No | Opaque value passed through to the redirect |
| `nonce` | No | Value included in the ID token |
| `code_challenge` | No | PKCE code challenge (S256) |
| `code_challenge_method` | No | Must be `S256` if code_challenge is provided |

### Example Authorization URL

```
http://localhost:9229/oauth2/authorize?client_id=my-app-local&redirect_uri=http://localhost:3000/callback&response_type=code&scope=openid+email+profile&state=abc123
```

## Login Page

The login page renders a card for each user in the pool, showing:

- Avatar with first initial
- User's name (from `name` attribute or email)
- Email address
- Group memberships

Clicking a user card submits a POST to `/oauth2/authorize/callback` which:

1. Creates a one-time authorization code
2. Stores the code with the associated user, client, redirect URI, scope, nonce, and PKCE challenge
3. Redirects to the `redirect_uri` with `?code=...&state=...`

Authorization codes expire after 2 minutes and can only be used once.
