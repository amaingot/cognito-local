---
title: "REFRESH_TOKEN_AUTH Flow"
description: "How to exchange a refresh token for new access and ID tokens using the cognito-local SDK API."
---

When an access token expires, you can use a refresh token to obtain new access and ID tokens without requiring the user to re-enter their credentials. This is the `REFRESH_TOKEN_AUTH` flow.

## Overview

1. Obtain a refresh token from a previous authentication (e.g., `USER_PASSWORD_AUTH`).
2. Call `InitiateAuth` with `AuthFlow: REFRESH_TOKEN_AUTH` and the refresh token.
3. Receive new access and ID tokens in the response.

## curl example

```bash
curl -X POST http://localhost:9229/ \
  -H "Content-Type: application/x-amz-json-1.1" \
  -H "X-Amz-Target: AWSCognitoIdentityProviderService.InitiateAuth" \
  -d '{
    "AuthFlow": "REFRESH_TOKEN_AUTH",
    "ClientId": "my-app-local",
    "AuthParameters": {
      "REFRESH_TOKEN": "eyJhbGciOiJSUzI1NiIs..."
    }
  }'
```

A successful response contains new access and ID tokens:

```json
{
  "AuthenticationResult": {
    "AccessToken": "eyJhbGciOiJSUzI1NiIs...",
    "IdToken": "eyJhbGciOiJSUzI1NiIs...",
    "ExpiresIn": 3600,
    "TokenType": "Bearer"
  },
  "ChallengeParameters": {}
}
```

Note that the response does **not** include a new refresh token. The original refresh token remains valid and can be used again.

## AuthFlow values

Both of the following values are accepted for the `AuthFlow` parameter:

- `REFRESH_TOKEN_AUTH`
- `REFRESH_TOKEN`

They behave identically. This matches the behavior of the real AWS Cognito service, which accepts both values.

## Token behavior

- **No rotation**: The original refresh token is not rotated or invalidated. You can reuse the same refresh token multiple times to obtain new access/ID tokens.
- **New tokens**: Each call returns freshly signed access and ID tokens with updated expiration times.

## Error conditions

The refresh token exchange can fail in several situations:

### Invalid or expired token

If the refresh token is malformed, expired, or was not issued by cognito-local:

```json
{
  "__type": "NotAuthorizedException",
  "message": "Invalid Refresh Token"
}
```

### Client ID mismatch

If the `ClientId` in the refresh request does not match the client that originally issued the token:

```json
{
  "__type": "NotAuthorizedException",
  "message": "Invalid Refresh Token"
}
```

### User deleted

If the user associated with the refresh token has been deleted from the user pool since the token was issued, the refresh will fail.

## Python example

```python
import boto3

client = boto3.client(
    "cognito-idp",
    region_name="us-east-1",
    endpoint_url="http://localhost:9229",
    aws_access_key_id="test",
    aws_secret_access_key="test",
)

# First, authenticate to get a refresh token
auth_response = client.initiate_auth(
    AuthFlow="USER_PASSWORD_AUTH",
    ClientId="my-app-local",
    AuthParameters={
        "USERNAME": "alice@example.com",
        "PASSWORD": "Password1!",
    },
)

refresh_token = auth_response["AuthenticationResult"]["RefreshToken"]

# Later, use the refresh token to get new access/ID tokens
refresh_response = client.initiate_auth(
    AuthFlow="REFRESH_TOKEN_AUTH",
    ClientId="my-app-local",
    AuthParameters={
        "REFRESH_TOKEN": refresh_token,
    },
)

new_tokens = refresh_response["AuthenticationResult"]
print("New access token:", new_tokens["AccessToken"])
print("New ID token:", new_tokens["IdToken"])
```

## JavaScript example

```typescript
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({
  region: "us-east-1",
  endpoint: "http://localhost:9229",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

// Use a refresh token from a previous authentication
const response = await client.send(
  new InitiateAuthCommand({
    AuthFlow: "REFRESH_TOKEN_AUTH",
    ClientId: "my-app-local",
    AuthParameters: {
      REFRESH_TOKEN: refreshToken,
    },
  })
);

console.log("New access token:", response.AuthenticationResult?.AccessToken);
console.log("New ID token:", response.AuthenticationResult?.IdToken);
```
