---
title: Admin Operations
description: Server-side user management with cognito-local using AdminGetUser, AdminUpdateUserAttributes, AdminDeleteUserAttributes, AdminDeleteUser, and ListUsers.
---

Admin operations require `UserPoolId` directly (not `ClientId`). They are used for server-side user management.

## AdminGetUser

Retrieves a user's details.

**Request:**

```json
{
  "UserPoolId": "us-east-1_localDev01",
  "Username": "user-001"
}
```

**Success Response:**

```json
{
  "Username": "user-001",
  "UserAttributes": [
    { "Name": "sub", "Value": "user-001" },
    { "Name": "email", "Value": "alice@example.com" },
    { "Name": "email_verified", "Value": "true" },
    { "Name": "given_name", "Value": "Alice" },
    { "Name": "family_name", "Value": "Smith" }
  ],
  "UserStatus": "CONFIRMED",
  "Enabled": true,
  "UserCreateDate": "2024-01-01T00:00:00.000Z",
  "UserLastModifiedDate": "2024-01-01T00:00:00.000Z"
}
```

## AdminUpdateUserAttributes

Updates user attributes. If the `email` attribute is updated, the top-level email field is also updated (normalized to lowercase).

**Request:**

```json
{
  "UserPoolId": "us-east-1_localDev01",
  "Username": "user-001",
  "UserAttributes": [
    { "Name": "given_name", "Value": "Alicia" },
    { "Name": "nickname", "Value": "Ali" }
  ]
}
```

**Success Response:** `{}`

## AdminDeleteUserAttributes

Removes attributes from a user.

**Request:**

```json
{
  "UserPoolId": "us-east-1_localDev01",
  "Username": "user-001",
  "UserAttributeNames": ["nickname", "phone_number"]
}
```

**Success Response:** `{}`

## AdminDeleteUser

Deletes a user and revokes all their refresh tokens.

**Request:**

```json
{
  "UserPoolId": "us-east-1_localDev01",
  "Username": "user-001"
}
```

**Success Response:** `{}`

## ListUsers

Lists users in a pool with optional filtering and pagination.

**Request:**

```json
{
  "UserPoolId": "us-east-1_localDev01",
  "Filter": "email = \"alice@example.com\"",
  "Limit": 10,
  "PaginationToken": "0"
}
```

**Filter syntax:** `attribute = "value"` (only exact match equality supported). The attribute name refers to user attributes (e.g., `email`, `given_name`, `family_name`).

**Success Response:**

```json
{
  "Users": [
    {
      "Username": "user-001",
      "Attributes": [
        { "Name": "email", "Value": "alice@example.com" },
        { "Name": "email_verified", "Value": "true" }
      ],
      "UserStatus": "CONFIRMED",
      "Enabled": true,
      "UserCreateDate": "2024-01-01T00:00:00.000Z",
      "UserLastModifiedDate": "2024-01-01T00:00:00.000Z"
    }
  ],
  "PaginationToken": "10"
}
```

`PaginationToken` is only present if there are more results. The default page size is 60.
