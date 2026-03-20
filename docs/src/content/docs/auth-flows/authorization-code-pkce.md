---
title: "Authorization Code Flow with PKCE"
description: "Full walkthrough of the OIDC authorization code flow with PKCE (Proof Key for Code Exchange) using cognito-local."
---

The authorization code flow with PKCE is the recommended authentication flow for single-page applications and native apps. It provides a secure way to exchange an authorization code for tokens without exposing a client secret in the browser.

## Overview

1. Generate a `code_verifier` (random 43-128 character string).
2. Compute `code_challenge` = base64url(SHA256(code_verifier)).
3. Redirect the user to the `/oauth2/authorize` endpoint with the code challenge.
4. The user sees the login page with a user picker and selects a user.
5. The server redirects back to your `redirect_uri` with an authorization code.
6. Exchange the code for tokens by calling `POST /oauth2/token` with the `code_verifier`.

## Step 1: Generate PKCE codes

The code verifier is a cryptographically random string between 43 and 128 characters. The code challenge is its SHA256 hash, base64url-encoded.

```bash
CODE_VERIFIER=$(openssl rand -base64 32 | tr -d '=/+' | head -c 43)
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')
echo "Verifier: $CODE_VERIFIER"
echo "Challenge: $CODE_CHALLENGE"
```

## Step 2: Redirect to the authorize endpoint

Build the authorization URL and redirect the user to it (or open it in a browser):

```bash
AUTHORIZE_URL="http://localhost:9229/oauth2/authorize?\
client_id=my-app-local&\
redirect_uri=http://localhost:3000/callback&\
response_type=code&\
scope=openid+email+profile&\
state=random-state-value&\
code_challenge=$CODE_CHALLENGE&\
code_challenge_method=S256"

echo "Open in browser: $AUTHORIZE_URL"
```

Parameters:

| Parameter | Description |
|---|---|
| `client_id` | Your app client ID from the configuration |
| `redirect_uri` | Must match one of the client's configured `callbackUrls` |
| `response_type` | Must be `code` |
| `scope` | Space-separated scopes (e.g., `openid email profile`) |
| `state` | Random string to prevent CSRF attacks; returned unchanged in the redirect |
| `code_challenge` | Base64url-encoded SHA256 hash of the code verifier |
| `code_challenge_method` | Must be `S256` |

## Step 3: User selects identity on the login page

Unlike real AWS Cognito, cognito-local's login page does not require a password. Instead, it displays a **user picker** showing all users in the user pool. The user simply clicks on their name to authenticate. This makes testing fast -- just click the user you want to log in as.

## Step 4: Handle the redirect

After the user selects their identity, the server redirects to your `redirect_uri` with the authorization code and state:

```
http://localhost:3000/callback?code=AUTH_CODE_HERE&state=random-state-value
```

Your application should:

1. Verify the `state` matches what you sent in step 2.
2. Extract the `code` parameter.

## Step 5: Exchange the code for tokens

Send a `POST` request to the token endpoint with the authorization code and code verifier:

```bash
curl -X POST http://localhost:9229/oauth2/token \
  -d "grant_type=authorization_code" \
  -d "code=AUTH_CODE_HERE" \
  -d "redirect_uri=http://localhost:3000/callback" \
  -d "client_id=my-app-local" \
  -d "code_verifier=$CODE_VERIFIER"
```

If the client has a secret configured, include it as well:

```bash
curl -X POST http://localhost:9229/oauth2/token \
  -u "my-app-local:local-secret" \
  -d "grant_type=authorization_code" \
  -d "code=AUTH_CODE_HERE" \
  -d "redirect_uri=http://localhost:3000/callback" \
  -d "code_verifier=$CODE_VERIFIER"
```

A successful response:

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "id_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

## Important notes

### Auth codes expire quickly

Authorization codes expire after **2 minutes** and are **single-use**. Once a code has been exchanged for tokens, it cannot be used again. If you need new tokens, start the flow over from the authorize endpoint.

### PKCE verification

When you exchange the code for tokens, the server verifies the `code_verifier` against the `code_challenge` that was stored when the authorization code was created. It does this by computing SHA256(code_verifier) and comparing it to the original code_challenge. If they do not match, the token exchange is rejected.

### Simulating the callback programmatically

For automated testing, you can simulate the user clicking on a user in the login page by posting directly to the callback endpoint:

```bash
AUTH_CODE=$(curl -s -o /dev/null -D - -X POST \
  http://localhost:9229/oauth2/authorize/callback \
  -d "userId=user-001" \
  -d "client_id=my-app-local" \
  -d "redirect_uri=http://localhost:3000/callback" \
  -d "scope=openid email profile" \
  -d "state=random-state-value" \
  -d "code_challenge=$CODE_CHALLENGE" \
  -d "code_challenge_method=S256" \
  | grep Location | sed 's/.*code=\([^&]*\).*/\1/' | tr -d '\r')

echo "Auth code: $AUTH_CODE"
```

This bypasses the browser-based login page and directly returns the redirect with the authorization code.
