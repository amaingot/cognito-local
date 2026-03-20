---
title: Getting Started
description: Set up cognito-local with Docker, Docker Compose, or a local Node.js development environment.
---

## Prerequisites

You need **one** of the following:

- **Docker** (recommended) -- any recent version that supports `docker run` or Docker Compose v2.
- **Node.js 20+** -- if you prefer to run the emulator directly or contribute to the project.

## Docker Quick Start

Run the emulator with a single command:

```bash
docker run -d \
  --name cognito-local \
  -p 9229:9229 \
  -v ./config.json:/config/config.json \
  -v ./users.json:/config/users.json \
  ghcr.io/amaingot/cognito-local:latest
```

| Flag | Purpose |
|------|---------|
| `-d` | Run in the background (detached mode). |
| `--name cognito-local` | Give the container a predictable name. |
| `-p 9229:9229` | Map the container's port 9229 to your host. |
| `-v ./config.json:/config/config.json` | Mount your pool and client configuration. |
| `-v ./users.json:/config/users.json` | Mount your pre-seeded user data. |

## Docker Compose Quick Start

Add the service to your `docker-compose.yml`:

```yaml
services:
  cognito:
    image: ghcr.io/amaingot/cognito-local:latest
    ports:
      - "9229:9229"
    volumes:
      - "./config.json:/config/config.json"
      - "./users.json:/config/users.json"
      - "./temp-data:/temp-data"
```

The `./temp-data` volume persists RSA keys and runtime data across container restarts so that tokens issued before a restart remain valid.

Start the service:

```bash
docker compose up -d
```

## Local Development Quick Start

Clone the repository and install dependencies:

```bash
git clone https://github.com/amaingot/cognito-local.git
cd cognito-local
npm install
```

Start the server with hot reload:

```bash
npm run dev
```

The emulator starts on `http://localhost:9229` using the example configuration files in the `config/` directory. Edit `config/config.example.json` and `config/users.example.json` to customize your local setup.

## Minimal Configuration

### config.json

Create a `config.json` file that defines your user pool and at least one app client:

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

### users.json

Create a `users.json` file with your pre-seeded test users:

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
      "family_name": "Smith"
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
      "family_name": "Jones"
    },
    "groups": ["Everyone"]
  }
]
```

Each user object supports the following fields:

- **username** -- Unique identifier for the user.
- **email** -- The user's email address.
- **password** -- Plain-text password used for authentication.
- **status** -- Set to `CONFIRMED` so the user can sign in immediately, or `UNCONFIRMED` to test confirmation flows.
- **attributes** -- Arbitrary key-value pairs that map to Cognito user attributes.
- **groups** -- List of group names. These appear in the `cognito:groups` claim in issued tokens.

## Verifying It Works

Once the emulator is running, confirm it is healthy by hitting the OIDC discovery endpoint:

```bash
curl http://localhost:9229/us-east-1_localDev01/.well-known/openid-configuration
```

You should receive a JSON response containing the issuer, authorization endpoint, token endpoint, and other standard OIDC metadata. For example:

```json
{
  "issuer": "http://localhost:9229/us-east-1_localDev01",
  "authorization_endpoint": "http://localhost:9229/us-east-1_localDev01/oauth2/authorize",
  "token_endpoint": "http://localhost:9229/us-east-1_localDev01/oauth2/token",
  "userinfo_endpoint": "http://localhost:9229/us-east-1_localDev01/oauth2/userInfo",
  "jwks_uri": "http://localhost:9229/us-east-1_localDev01/.well-known/jwks.json",
  ...
}
```

If you see this response, the emulator is running correctly and ready to accept authentication requests.

You can also fetch the JSON Web Key Set to confirm the RSA signing key is available:

```bash
curl http://localhost:9229/us-east-1_localDev01/.well-known/jwks.json
```

## What's Next

- **[Configuration](/configuration/)** -- Full reference for `config.json` options, environment variables, and user pool settings.
- **[OIDC Endpoints](/oidc/)** -- Details on the hosted UI login page, authorization code flow, token exchange, and userinfo.
- **[SDK Operations](/sdk/)** -- Supported Cognito API operations and how to point the AWS SDK at the local emulator.
- **[Examples](/examples/)** -- End-to-end examples using popular frameworks and libraries.
