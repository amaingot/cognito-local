---
title: Authentication (InitiateAuth)
description: Authenticate users with cognito-local using USER_PASSWORD_AUTH or REFRESH_TOKEN_AUTH flows via the InitiateAuth SDK operation.
---

## InitiateAuth

Authenticates a user and returns tokens.

**Request:**

```json
{
  "AuthFlow": "USER_PASSWORD_AUTH",
  "ClientId": "my-app-local",
  "AuthParameters": {
    "USERNAME": "alice@example.com",
    "PASSWORD": "Password1!"
  }
}
```

## Supported Auth Flows

### USER_PASSWORD_AUTH

Direct username/password authentication. The `USERNAME` field can be either:

- The user's `username` (e.g., `"user-001"`)
- The user's `email` (e.g., `"alice@example.com"`)

The server tries username lookup first, then falls back to email lookup.

**Success Response:**

```json
{
  "AuthenticationResult": {
    "AccessToken": "eyJ...",
    "IdToken": "eyJ...",
    "RefreshToken": "...",
    "ExpiresIn": 3600,
    "TokenType": "Bearer"
  }
}
```

**Error conditions:**

- User not found -- `UserNotFoundException`
- User is disabled -- `NotAuthorizedException` ("User is disabled.")
- User not confirmed -- `NotAuthorizedException` ("User is not confirmed.")
- Wrong password -- `NotAuthorizedException` ("Incorrect username or password.")

### REFRESH_TOKEN_AUTH

Exchanges a refresh token for new access and ID tokens. Also accepted as `REFRESH_TOKEN`.

```json
{
  "AuthFlow": "REFRESH_TOKEN_AUTH",
  "ClientId": "my-app-local",
  "AuthParameters": {
    "REFRESH_TOKEN": "your-refresh-token"
  }
}
```

Response includes new `AccessToken` and `IdToken` but no new `RefreshToken` (the existing one remains valid).

**Error conditions:**

- Invalid or expired refresh token -- `NotAuthorizedException`
- Client ID mismatch -- `NotAuthorizedException`

### USER_SRP_AUTH (Not Supported)

SRP (Secure Remote Password) authentication is not supported. If attempted, the server returns a helpful error:

```json
{
  "__type": "InvalidParameterException",
  "message": "USER_SRP_AUTH is not supported by cognito-local. Use USER_PASSWORD_AUTH instead."
}
```

## curl Example

```bash
curl -X POST http://localhost:9229/ \
  -H "Content-Type: application/x-amz-json-1.1" \
  -H "X-Amz-Target: AWSCognitoIdentityProviderService.InitiateAuth" \
  -d '{
    "AuthFlow": "USER_PASSWORD_AUTH",
    "ClientId": "my-app-local",
    "AuthParameters": {
      "USERNAME": "alice@example.com",
      "PASSWORD": "Password1!"
    }
  }'
```
