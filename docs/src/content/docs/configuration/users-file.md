---
title: Users File (users.json)
description: Full schema reference for the cognito-local seed users JSON file.
---

The users file is a JSON array of user objects that are seeded into the data store when the server starts. By default the server looks for it at `/config/users.json`, but you can change the path with the `USERS_FILE` environment variable.

## Schema

Each element in the array is a user object with the following fields:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `username` | string | Yes | -- | Unique username identifier |
| `email` | string | Yes | -- | User's email address (normalized to lowercase) |
| `password` | string | Yes | -- | User's password (stored in plain text for local dev) |
| `status` | string | No | `"CONFIRMED"` | One of: `UNCONFIRMED`, `CONFIRMED`, `FORCE_CHANGE_PASSWORD` |
| `attributes` | object | No | `{}` | Key-value pairs of user attributes |
| `groups` | array | No | `[]` | Array of group names the user belongs to |

## Full example

This is the contents of `config/users.example.json` shipped with the project:

```json
[
  {
    "username": "user-001",
    "email": "alice@example.com",
    "password": "Password1!",
    "status": "CONFIRMED",
    "attributes": {
      "email_verified": "true",
      "given_name": "Alice",
      "family_name": "Smith",
      "nickname": "alice"
    },
    "groups": ["Admin", "Everyone"]
  },
  {
    "username": "user-002",
    "email": "bob@example.com",
    "password": "Password1!",
    "status": "CONFIRMED",
    "attributes": {
      "email_verified": "true",
      "given_name": "Bob",
      "family_name": "Jones",
      "nickname": "bob"
    },
    "groups": ["Everyone"]
  }
]
```

## Seeding behavior

Users defined in the users file are seeded into the data store at startup. The following rules apply:

- **Skip existing users** -- If a user with the same `username` already exists in the persisted data store for the configured user pool, the seed entry is skipped. This means your persisted data is never overwritten by seed data on restart.
- **Email normalization** -- The `email` field is normalized to lowercase before storage, regardless of the casing in the users file.
- **Automatic attributes** -- Two attributes are automatically set for every seeded user:
  - `email_verified` is set to `"true"`
  - `sub` is set to the value of `username`

  These auto-set values can be overridden by explicitly providing them in the `attributes` object. Since `attributes` are merged after the defaults, your explicit values take precedence.
- **Default status** -- If `status` is omitted, the user is created as `CONFIRMED` and can sign in immediately.

## Groups in JWT tokens

Group memberships defined in the `groups` array appear in JWT tokens under the `cognito:groups` claim. This matches the behavior of AWS Cognito, allowing your application to use group-based authorization logic without modification.

## Password storage

Passwords are stored in plain text. This is intentional -- cognito-local is designed exclusively for local development and testing. Never use it in a production environment or with real user credentials.
