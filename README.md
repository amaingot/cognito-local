# cognito-local

Local emulation of Amazon Cognito authentication services. A plug-and-play Docker image for local development and testing.

**[Read the full documentation](https://amaingot.github.io/cognito-local/)**

## Features

- **OIDC/Hosted UI** - Full OIDC-compliant provider with login page, token exchange, and userinfo
- **Cognito SDK API** - AWS SDK-compatible endpoint (`boto3`, `@aws-sdk/client-cognito-identity-provider`)
- **Cognito-style tokens** - JWTs with `cognito:groups`, `cognito:username`, `token_use` claims
- **PKCE support** - Authorization code flow with S256 code challenge
- **Multiple auth flows** - Authorization code, password grant, refresh token
- **Persistent data** - RSA keys and user data survive container restarts
- **Pre-seeded users** - Configure test users via JSON file

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
