---
title: "JavaScript (AWS SDK v3)"
description: "Complete JavaScript and TypeScript examples using the AWS SDK v3 to interact with the cognito-local SDK API."
---

These examples show how to use the [@aws-sdk/client-cognito-identity-provider](https://www.npmjs.com/package/@aws-sdk/client-cognito-identity-provider) package with cognito-local.

## Installation

```bash
npm install @aws-sdk/client-cognito-identity-provider
```

## Client setup

```typescript
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  AdminGetUserCommand,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({
  region: "us-east-1",
  endpoint: "http://localhost:9229",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});
```

The `accessKeyId` and `secretAccessKey` can be any non-empty string. cognito-local does not validate AWS credentials.

## InitiateAuth (USER_PASSWORD_AUTH)

Authenticate a user with their username or email and password:

```typescript
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

const { AccessToken, IdToken, RefreshToken } =
  response.AuthenticationResult!;

console.log("Access token:", AccessToken);
console.log("ID token:", IdToken);
console.log("Refresh token:", RefreshToken);
```

## SignUp

Register a new user account:

```typescript
const response = await client.send(
  new SignUpCommand({
    ClientId: "my-app-local",
    Username: "bob",
    Password: "SecurePass1!",
    UserAttributes: [
      { Name: "email", Value: "bob@example.com" },
      { Name: "name", Value: "Bob Smith" },
    ],
  })
);

console.log("User sub:", response.UserSub);
console.log("Confirmed:", response.UserConfirmed);
```

New users are created in an unconfirmed state. They must be confirmed before they can authenticate.

## ConfirmSignUp

Confirm a user's registration. cognito-local accepts any non-empty string as the confirmation code:

```typescript
await client.send(
  new ConfirmSignUpCommand({
    ClientId: "my-app-local",
    Username: "bob",
    ConfirmationCode: "123456",
  })
);

console.log("User confirmed successfully");
```

After confirmation, the user can authenticate using `InitiateAuth`.

## AdminGetUser

Retrieve detailed information about a user (admin operation):

```typescript
const response = await client.send(
  new AdminGetUserCommand({
    UserPoolId: "us-east-1_localDev01",
    Username: "alice",
  })
);

console.log("Username:", response.Username);
console.log("Status:", response.UserStatus);
console.log("Attributes:");
for (const attr of response.UserAttributes ?? []) {
  console.log(`  ${attr.Name}: ${attr.Value}`);
}
```

## ListUsers

List users in a user pool, optionally filtering by attribute:

```typescript
// List all users
const response = await client.send(
  new ListUsersCommand({
    UserPoolId: "us-east-1_localDev01",
  })
);

for (const user of response.Users ?? []) {
  console.log(`  ${user.Username} - ${user.UserStatus}`);
}

// Filter by email
const filtered = await client.send(
  new ListUsersCommand({
    UserPoolId: "us-east-1_localDev01",
    Filter: 'email = "alice@example.com"',
  })
);

for (const user of filtered.Users ?? []) {
  const email = user.Attributes?.find((a) => a.Name === "email")?.Value;
  console.log(`  ${user.Username} (${email})`);
}
```

## Complete example

Here is a full script that signs up a user, confirms them, and authenticates:

```typescript
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const client = new CognitoIdentityProviderClient({
  region: "us-east-1",
  endpoint: "http://localhost:9229",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

// 1. Sign up
const signUpResponse = await client.send(
  new SignUpCommand({
    ClientId: "my-app-local",
    Username: "newuser",
    Password: "MyPassword1!",
    UserAttributes: [
      { Name: "email", Value: "newuser@example.com" },
    ],
  })
);
console.log("Signed up user:", signUpResponse.UserSub);

// 2. Confirm
await client.send(
  new ConfirmSignUpCommand({
    ClientId: "my-app-local",
    Username: "newuser",
    ConfirmationCode: "123456",
  })
);
console.log("User confirmed");

// 3. Authenticate
const authResponse = await client.send(
  new InitiateAuthCommand({
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: "my-app-local",
    AuthParameters: {
      USERNAME: "newuser",
      PASSWORD: "MyPassword1!",
    },
  })
);

const tokens = authResponse.AuthenticationResult!;
console.log(`Authenticated! Token expires in ${tokens.ExpiresIn}s`);
```
