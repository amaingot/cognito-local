---
title: User Registration
description: Register and confirm users with cognito-local using the SignUp, ConfirmSignUp, and ResendConfirmationCode SDK operations.
---

## SignUp

Registers a new user. The user starts in `UNCONFIRMED` status and must confirm via `ConfirmSignUp`.

**Request:**

```json
{
  "ClientId": "my-app-local",
  "Password": "Password1!",
  "UserAttributes": [
    { "Name": "email", "Value": "newuser@example.com" },
    { "Name": "given_name", "Value": "New" },
    { "Name": "family_name", "Value": "User" }
  ]
}
```

**Success Response:**

```json
{
  "UserConfirmed": false,
  "UserSub": "newuser@example.com"
}
```

**Notes:**

- An `email` attribute is required.
- If the pool has `usernameAttributes: ["email"]` (the default), the email becomes the username.
- The confirmation code is logged to the server console: `[SignUp] User newuser@example.com created with confirmation code: 123456`
- Email is normalized to lowercase.
- Duplicate emails return `UsernameExistsException`.

## ConfirmSignUp

Confirms a user's registration using the confirmation code.

**Request:**

```json
{
  "ClientId": "my-app-local",
  "Username": "newuser@example.com",
  "ConfirmationCode": "123456"
}
```

**Success Response:** `{}` (empty object)

**Behavior:**

- Sets user status from `UNCONFIRMED` to `CONFIRMED`.
- Sets `email_verified` to `"true"`.
- Clears the confirmation code.
- Username lookup supports both username and email (case-insensitive for email).

**Error conditions:**

- Wrong code -- `CodeMismatchException`
- User not found -- `UserNotFoundException`

## ResendConfirmationCode

Generates a new confirmation code for an unconfirmed user.

**Request:**

```json
{
  "ClientId": "my-app-local",
  "Username": "newuser@example.com"
}
```

**Success Response:**

```json
{
  "CodeDeliveryDetails": {
    "Destination": "n***r@example.com",
    "DeliveryMedium": "EMAIL",
    "AttributeName": "email"
  }
}
```

The new code is logged to the server console. The email destination is masked in the response (first and last character of the local part visible).
