---
title: Config File (config.json)
description: Full schema reference for the cognito-local configuration JSON file.
---

The config file is a JSON object that defines the server settings, user pool identity, and client configurations. By default the server looks for it at `/config/config.json`, but you can change the path with the `CONFIG_FILE` environment variable.

## Schema

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `region` | string | `"us-east-1"` | AWS region identifier |
| `userPoolId` | string | `"us-east-1_localDev01"` | User pool ID (must match region prefix) |
| `userPoolName` | string | `"cognito-local"` | Display name for the user pool |
| `port` | number | `9229` | Server port |
| `issuerHost` | string | `"http://localhost:{port}"` | Base URL for the issuer (auto-generated if empty) |
| `dataDir` | string | `"/temp-data"` | Directory for persistent data (keys, store files) |
| `clients` | array | `[]` | Array of client configurations (see [Client Settings](../client-settings/)) |

All fields are optional. Any field not present in the file falls back to its default value.

## User pool ID format

The `userPoolId` must follow the AWS Cognito format: a region prefix followed by an underscore and an alphanumeric identifier. For example, `us-east-1_localDev01`. The region portion should match the `region` field.

## Issuer host

The `issuerHost` value is used as the base URL for OIDC discovery endpoints and the `iss` claim in JWT tokens. The full issuer URL is constructed as `{issuerHost}/{userPoolId}`.

If `issuerHost` is empty or omitted, it is automatically set to `http://localhost:{port}` using the resolved port value.

## Full example

This is the contents of `config/config.example.json` shipped with the project:

```json
{
  "region": "us-east-1",
  "userPoolId": "us-east-1_localDev01",
  "userPoolName": "cognito-local",
  "port": 9229,
  "clients": [
    {
      "clientId": "my-app-local",
      "clientSecret": "local-secret",
      "clientName": "My App",
      "callbackUrls": ["http://localhost:3000/callback"],
      "logoutUrls": ["http://localhost:3000"],
      "explicitAuthFlows": [
        "ALLOW_USER_PASSWORD_AUTH",
        "ALLOW_REFRESH_TOKEN_AUTH"
      ],
      "allowedOAuthFlows": ["code"],
      "allowedOAuthScopes": ["openid", "email", "profile"]
    }
  ]
}
```

## Minimal example

A config file with only the required overrides (everything else uses defaults):

```json
{
  "clients": [
    {
      "clientId": "my-app",
      "clientName": "My App"
    }
  ]
}
```

This creates a single public client (no secret) with all default OAuth settings.
