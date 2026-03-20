---
title: "USER_PASSWORD_AUTH Flow"
description: "Step-by-step guide to the direct password authentication flow via the cognito-local SDK API."
---

The `USER_PASSWORD_AUTH` flow is the simplest way to authenticate a user against cognito-local using the AWS SDK-compatible API. The client sends a username and password directly, and receives JWT tokens in the response.

## Overview

1. Configure your SDK client to point at cognito-local.
2. Call `InitiateAuth` with `AuthFlow: USER_PASSWORD_AUTH`.
3. Receive access, ID, and refresh tokens in the response.

## Request format

The SDK API expects a `POST /` request with the `X-Amz-Target` header set to `AWSCognitoIdentityProviderService.InitiateAuth`. The body contains the auth flow, client ID, and auth parameters.

The `USERNAME` parameter accepts either a username or an email address. If you provide an email, cognito-local will look up the user by their email attribute.

## curl example

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

A successful response looks like:

```json
{
  "AuthenticationResult": {
    "AccessToken": "eyJhbGciOiJSUzI1NiIs...",
    "IdToken": "eyJhbGciOiJSUzI1NiIs...",
    "RefreshToken": "eyJhbGciOiJSUzI1NiIs...",
    "ExpiresIn": 3600,
    "TokenType": "Bearer"
  },
  "ChallengeParameters": {}
}
```

## Python (boto3) example

```python
import boto3

client = boto3.client(
    "cognito-idp",
    region_name="us-east-1",
    endpoint_url="http://localhost:9229",
    aws_access_key_id="test",
    aws_secret_access_key="test",
)

response = client.initiate_auth(
    AuthFlow="USER_PASSWORD_AUTH",
    ClientId="my-app-local",
    AuthParameters={
        "USERNAME": "alice@example.com",
        "PASSWORD": "Password1!",
    },
)

tokens = response["AuthenticationResult"]
print("Access token:", tokens["AccessToken"])
print("ID token:", tokens["IdToken"])
print("Refresh token:", tokens["RefreshToken"])
```

## JavaScript (AWS SDK v3) example

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

const response = await client.send(
  new InitiateAuthCommand({
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: "my-app-local",
    AuthParameters: {
      USERNAME: "alice@example.com",
      PASSWORD: "Password1!",
    },
  })
);

console.log("Access token:", response.AuthenticationResult?.AccessToken);
console.log("ID token:", response.AuthenticationResult?.IdToken);
console.log("Refresh token:", response.AuthenticationResult?.RefreshToken);
```

## Username vs. email

The `USERNAME` field accepts either value:

- **Username**: the user's `username` field as defined in your `users.json` (e.g., `alice`).
- **Email**: the user's `email` attribute (e.g., `alice@example.com`).

When an email is provided, cognito-local searches for a user with a matching email attribute in the specified user pool.

## A note on USER_SRP_AUTH

The `USER_SRP_AUTH` flow (Secure Remote Password) is **not supported** by cognito-local. If you attempt to use it, you will receive an error response suggesting you use `USER_PASSWORD_AUTH` instead.

SRP requires a multi-step challenge-response protocol that adds significant complexity. Since cognito-local is intended for local development and testing, the simpler `USER_PASSWORD_AUTH` flow is sufficient for all use cases. If your production code uses SRP, you can switch the auth flow based on an environment variable:

```typescript
const authFlow =
  process.env.NODE_ENV === "development"
    ? "USER_PASSWORD_AUTH"
    : "USER_SRP_AUTH";
```
