# cognito-local

Full-featured local emulator for Amazon Cognito authentication services. A plug-and-play Docker image for local development and testing.

**[Read the full documentation](https://amaingot.github.io/cognito-local/)**

## What's in 1.0

cognito-local 1.0 covers the full AWS Cognito SDK surface, all 9 Lambda trigger families, MFA, multi-pool configuration, and a complete OIDC / Hosted UI provider — all in a single Docker image.

### Features

- **OIDC / Hosted UI** — full provider with server-rendered login page, `/oauth2/authorize`, `/oauth2/token` (auth_code + PKCE, password, refresh_token, **client_credentials**), `/oauth2/userInfo`, `/oauth2/revoke`, `/logout`
- **~110 Cognito SDK operations** — user self-service, admin, pool & client management, groups, custom attributes, identity providers, resource servers, devices, risk configuration, domains, UI customization, tags, user import jobs
- **9 Lambda trigger families** — `PreSignUp`, `PostConfirmation`, `PreAuthentication`, `PostAuthentication`, `PreTokenGeneration` (V1 + **V2**), `UserMigration`, `CustomMessage`, `CustomEmailSender`, `CustomSMSSender` — invokable via HTTP or AWS SDK v3 Lambda (honors `AWS_PROFILE`)
- **MFA / TOTP** — `AssociateSoftwareToken`, `VerifySoftwareToken`, `SetUserMFAPreference`, full `SOFTWARE_TOKEN_MFA` and `SMS_MFA` challenge flow
- **Multi-pool** — first-class data model with pool-scoped Lambda triggers
- **Structured logging** — `pino` + `pino-http` with per-request `reqId`
- **HTTPS server** — optional, with user-supplied certs
- **ALB-style public-keys endpoint** — `GET /:kid` returns PEM (for ALB user-pool integration)
- **Cognito wire format** — Dates emit as unix epoch seconds (matches real AWS SDK v3 clients)
- **Pre-seeded users** — configure test users via JSON file

## Migrating from 0.x

cognito-local 1.0 uses a new multi-pool config schema. See the [migration guide](https://amaingot.github.io/cognito-local/migration/v1/). The server will refuse to boot on an old 0.x config and print a clear migration message.

## Quick Start

### Docker

```bash
docker run -d \
  --name cognito-local \
  -p 9229:9229 \
  -v ./config.json:/config/config.json \
  -v ./users.json:/config/users.json \
  ghcr.io/amaingot/cognito-local:latest
```

### Docker Compose

```yaml
services:
  auth:
    image: ghcr.io/amaingot/cognito-local:latest
    ports:
      - "9229:9229"
    volumes:
      - "./config.json:/config/config.json"
      - "./users.json:/config/users.json"
      - "./temp/auth:/temp-data"
```

See the [Getting Started guide](https://amaingot.github.io/cognito-local/getting-started/) for configuration details and next steps.

## Development

```bash
npm install
npm run dev     # Start with hot reload
npm test        # Run tests
npm run build   # Compile TypeScript
```

## License

Apache-2.0
