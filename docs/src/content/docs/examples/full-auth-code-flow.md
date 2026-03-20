---
title: "Full Authorization Code Flow"
description: "End-to-end walkthrough of the complete OIDC authorization code flow using curl commands against cognito-local."
---

This guide walks through every step of the OIDC authorization code flow using curl commands. It covers discovery, PKCE generation, authorization, token exchange, user info, and token revocation.

## Step 1: Discover endpoints

Fetch the OpenID Connect discovery document to find all available endpoints:

```bash
curl -s http://localhost:9229/us-east-1_localDev01/.well-known/openid-configuration | jq
```

The response includes the URLs for the authorization, token, userinfo, JWKS, and revocation endpoints:

```json
{
  "issuer": "http://localhost:9229/us-east-1_localDev01",
  "authorization_endpoint": "http://localhost:9229/oauth2/authorize",
  "token_endpoint": "http://localhost:9229/oauth2/token",
  "userinfo_endpoint": "http://localhost:9229/oauth2/userInfo",
  "jwks_uri": "http://localhost:9229/us-east-1_localDev01/.well-known/jwks.json",
  "revocation_endpoint": "http://localhost:9229/oauth2/revoke",
  "response_types_supported": ["code"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "scopes_supported": ["openid", "email", "profile"]
}
```

## Step 2: Generate PKCE codes

Generate a code verifier and its corresponding code challenge for PKCE:

```bash
CODE_VERIFIER=$(openssl rand -base64 32 | tr -d '=/+' | head -c 43)
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')
echo "Verifier: $CODE_VERIFIER"
echo "Challenge: $CODE_CHALLENGE"
```

Save both values -- you will need the verifier in step 5 when exchanging the code for tokens.

## Step 3: Build the authorize URL

Construct the authorization URL with all required parameters:

```bash
AUTHORIZE_URL="http://localhost:9229/oauth2/authorize?\
client_id=my-app-local&\
redirect_uri=http://localhost:3000/callback&\
response_type=code&\
scope=openid+email+profile&\
state=test123&\
code_challenge=$CODE_CHALLENGE&\
code_challenge_method=S256"

echo "Open in browser: $AUTHORIZE_URL"
```

If you open this URL in a browser, you will see the cognito-local login page with a user picker. Click on a user to authenticate and be redirected back to your `redirect_uri` with an authorization code.

## Step 4: Simulate user selection

For automated testing or scripting, you can bypass the browser and simulate the user clicking on a user in the login page by posting directly to the callback endpoint:

```bash
AUTH_CODE=$(curl -s -o /dev/null -D - -X POST \
  http://localhost:9229/oauth2/authorize/callback \
  -d "userId=user-001" \
  -d "client_id=my-app-local" \
  -d "redirect_uri=http://localhost:3000/callback" \
  -d "scope=openid email profile" \
  -d "state=test123" \
  -d "code_challenge=$CODE_CHALLENGE" \
  -d "code_challenge_method=S256" \
  | grep Location | sed 's/.*code=\([^&]*\).*/\1/' | tr -d '\r')

echo "Auth code: $AUTH_CODE"
```

This extracts the authorization code from the `Location` redirect header. The `userId` must match a user ID in your configured users.

## Step 5: Exchange code for tokens

Use the authorization code and code verifier to obtain tokens:

```bash
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:9229/oauth2/token \
  -d "grant_type=authorization_code" \
  -d "code=$AUTH_CODE" \
  -d "redirect_uri=http://localhost:3000/callback" \
  -d "client_id=my-app-local" \
  -d "client_secret=local-secret" \
  -d "code_verifier=$CODE_VERIFIER")

echo "$TOKEN_RESPONSE" | jq
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

Extract the tokens for use in subsequent steps:

```bash
ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
REFRESH_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.refresh_token')
```

Important notes:
- The authorization code is **single-use**. It cannot be exchanged again.
- Authorization codes expire after **2 minutes**.
- The `code_verifier` is verified against the `code_challenge` from step 3 using SHA256. If they do not match, the request is rejected.

## Step 6: Get user info

Use the access token to fetch the authenticated user's profile:

```bash
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
  http://localhost:9229/oauth2/userInfo | jq
```

Example response:

```json
{
  "sub": "user-001",
  "email": "alice@example.com",
  "email_verified": true,
  "cognito:username": "alice",
  "cognito:groups": ["admin"]
}
```

## Step 7: Revoke token

Revoke a refresh token to invalidate it:

```bash
curl -s -X POST http://localhost:9229/oauth2/revoke \
  -d "token=$REFRESH_TOKEN"
```

A successful revocation returns an empty 200 response. After revocation, the refresh token can no longer be used to obtain new access tokens.

## Complete script

Here is the entire flow as a single copy-pasteable script:

```bash
#!/bin/bash
set -e

# Configuration
CLIENT_ID="my-app-local"
CLIENT_SECRET="local-secret"
REDIRECT_URI="http://localhost:3000/callback"
USER_ID="user-001"
BASE_URL="http://localhost:9229"

# 1. Generate PKCE codes
CODE_VERIFIER=$(openssl rand -base64 32 | tr -d '=/+' | head -c 43)
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')
echo "=== PKCE ==="
echo "Verifier: $CODE_VERIFIER"
echo "Challenge: $CODE_CHALLENGE"

# 2. Get authorization code
AUTH_CODE=$(curl -s -o /dev/null -D - -X POST \
  "$BASE_URL/oauth2/authorize/callback" \
  -d "userId=$USER_ID" \
  -d "client_id=$CLIENT_ID" \
  -d "redirect_uri=$REDIRECT_URI" \
  -d "scope=openid email profile" \
  -d "state=test123" \
  -d "code_challenge=$CODE_CHALLENGE" \
  -d "code_challenge_method=S256" \
  | grep Location | sed 's/.*code=\([^&]*\).*/\1/' | tr -d '\r')
echo ""
echo "=== Authorization Code ==="
echo "$AUTH_CODE"

# 3. Exchange code for tokens
TOKEN_RESPONSE=$(curl -s -X POST "$BASE_URL/oauth2/token" \
  -d "grant_type=authorization_code" \
  -d "code=$AUTH_CODE" \
  -d "redirect_uri=$REDIRECT_URI" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "code_verifier=$CODE_VERIFIER")
echo ""
echo "=== Tokens ==="
echo "$TOKEN_RESPONSE" | jq

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
REFRESH_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.refresh_token')

# 4. Get user info
echo ""
echo "=== User Info ==="
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
  "$BASE_URL/oauth2/userInfo" | jq

# 5. Revoke refresh token
echo ""
echo "=== Revoking refresh token ==="
curl -s -X POST "$BASE_URL/oauth2/revoke" \
  -d "token=$REFRESH_TOKEN"
echo "Done"
```
