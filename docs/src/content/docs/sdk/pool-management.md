---
title: Pool & Client Management
description: Create and inspect user pools and app clients with cognito-local using DescribeUserPool, CreateUserPool, and CreateUserPoolClient.
---

## DescribeUserPool

Returns details about a user pool.

**Request:**

```json
{
  "UserPoolId": "us-east-1_localDev01"
}
```

**Success Response:**

```json
{
  "UserPool": {
    "Id": "us-east-1_localDev01",
    "Name": "cognito-local",
    "Status": "Enabled",
    "LastModifiedDate": "2024-01-01T00:00:00.000Z",
    "CreationDate": "2024-01-01T00:00:00.000Z",
    "SchemaAttributes": [
      { "Name": "email", "AttributeDataType": "String", "Required": true, "Mutable": true },
      { "Name": "given_name", "AttributeDataType": "String", "Required": false, "Mutable": true },
      { "Name": "family_name", "AttributeDataType": "String", "Required": false, "Mutable": true },
      { "Name": "nickname", "AttributeDataType": "String", "Required": false, "Mutable": true },
      { "Name": "phone_number", "AttributeDataType": "String", "Required": false, "Mutable": true }
    ],
    "UsernameAttributes": ["email"]
  }
}
```

## CreateUserPool

Creates a new user pool with an auto-generated ID.

**Request:**

```json
{
  "PoolName": "my-new-pool",
  "Schema": [
    { "Name": "email", "AttributeDataType": "String", "Required": true, "Mutable": true },
    { "Name": "custom:tenant_id", "AttributeDataType": "String", "Required": false, "Mutable": true }
  ],
  "UsernameAttributes": ["email"]
}
```

**Notes:**

- `PoolName` is required.
- `Schema` defaults to `[{ name: "email", attributeDataType: "String", required: true, mutable: true }]` if not provided.
- `UsernameAttributes` defaults to `["email"]`.
- The pool ID is auto-generated as `{region}_{random9chars}` (e.g., `us-east-1_a1b2c3d4e`).

**Success Response:**

```json
{
  "UserPool": {
    "Id": "us-east-1_a1b2c3d4e",
    "Name": "my-new-pool",
    "Status": "Enabled",
    "SchemaAttributes": [
      { "Name": "email", "AttributeDataType": "String", "Required": true, "Mutable": true },
      { "Name": "custom:tenant_id", "AttributeDataType": "String", "Required": false, "Mutable": true }
    ],
    "UsernameAttributes": ["email"],
    "CreationDate": "...",
    "LastModifiedDate": "..."
  }
}
```

## CreateUserPoolClient

Creates a new app client for a user pool.

**Request:**

```json
{
  "UserPoolId": "us-east-1_localDev01",
  "ClientName": "My New Client",
  "GenerateSecret": true,
  "CallbackURLs": ["http://localhost:3000/callback"],
  "LogoutURLs": ["http://localhost:3000"],
  "ExplicitAuthFlows": ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
  "AllowedOAuthFlows": ["code"],
  "AllowedOAuthScopes": ["openid", "email", "profile"],
  "AccessTokenValidity": 3600,
  "IdTokenValidity": 3600,
  "RefreshTokenValidity": 2592000
}
```

**Notes:**

- `UserPoolId` and `ClientName` are required.
- `GenerateSecret: true` generates a random client secret.
- The client ID is auto-generated as a 26-character alphanumeric string.
- All other fields default to empty arrays or standard validity values (3600s for access/ID tokens, 30 days for refresh tokens).

**Success Response:**

```json
{
  "UserPoolClient": {
    "ClientId": "a1b2c3d4e5f6g7h8i9j0k1l2m3",
    "ClientName": "My New Client",
    "UserPoolId": "us-east-1_localDev01",
    "ClientSecret": "...",
    "CallbackURLs": ["http://localhost:3000/callback"],
    "LogoutURLs": ["http://localhost:3000"],
    "ExplicitAuthFlows": ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
    "AllowedOAuthFlows": ["code"],
    "AllowedOAuthScopes": ["openid", "email", "profile"],
    "AccessTokenValidity": 3600,
    "IdTokenValidity": 3600,
    "RefreshTokenValidity": 2592000
  }
}
```
