# cognito-local

Local emulation of Amazon Cognito authentication services. A plug-and-play Docker image for local development and testing.

## Documentation

Full documentation is available at [amaingot.github.io/cognito-local](https://amaingot.github.io/cognito-local/).

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

## Configuration

### config.json

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
      "explicitAuthFlows": ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
      "allowedOAuthFlows": ["code"],
      "allowedOAuthScopes": ["openid", "email", "profile"]
    }
  ]
}
```

### users.json

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
    "groups": ["Admin"]
  }
]
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `9229` | Server port |
| `CONFIG_FILE` | `/config/config.json` | Path to config file |
| `USERS_FILE` | `/config/users.json` | Path to users file |
| `DATA_DIR` | `/temp-data` | Persistent data directory |

## Endpoints

### OIDC / Hosted UI

| Endpoint | Path |
|---|---|
| Discovery | `GET /{poolId}/.well-known/openid-configuration` |
| JWKS | `GET /{poolId}/.well-known/jwks.json` |
| Authorize | `GET /oauth2/authorize` |
| Token | `POST /oauth2/token` |
| UserInfo | `GET /oauth2/userInfo` |
| Logout | `GET /logout` |
| Revoke | `POST /oauth2/revoke` |

### Cognito SDK API

All SDK operations are `POST /` with `X-Amz-Target` header:

| Operation | X-Amz-Target |
|---|---|
| InitiateAuth | `AWSCognitoIdentityProviderService.InitiateAuth` |
| SignUp | `AWSCognitoIdentityProviderService.SignUp` |
| ConfirmSignUp | `AWSCognitoIdentityProviderService.ConfirmSignUp` |
| ResendConfirmationCode | `AWSCognitoIdentityProviderService.ResendConfirmationCode` |
| AdminGetUser | `AWSCognitoIdentityProviderService.AdminGetUser` |
| AdminUpdateUserAttributes | `AWSCognitoIdentityProviderService.AdminUpdateUserAttributes` |
| AdminDeleteUserAttributes | `AWSCognitoIdentityProviderService.AdminDeleteUserAttributes` |
| AdminDeleteUser | `AWSCognitoIdentityProviderService.AdminDeleteUser` |
| ListUsers | `AWSCognitoIdentityProviderService.ListUsers` |
| DescribeUserPool | `AWSCognitoIdentityProviderService.DescribeUserPool` |
| CreateUserPool | `AWSCognitoIdentityProviderService.CreateUserPool` |
| CreateUserPoolClient | `AWSCognitoIdentityProviderService.CreateUserPoolClient` |

## Usage with AWS SDK

### Python (boto3)

```python
import boto3

client = boto3.client(
    'cognito-idp',
    region_name='us-east-1',
    endpoint_url='http://localhost:9229',
    aws_access_key_id='test',
    aws_secret_access_key='test'
)

# Authenticate
response = client.initiate_auth(
    AuthFlow='USER_PASSWORD_AUTH',
    ClientId='my-app-local',
    AuthParameters={
        'USERNAME': 'alice@example.com',
        'PASSWORD': 'Password1!'
    }
)
```

### Frontend (OIDC)

Configure your OIDC client with:
- **Authority**: `http://localhost:9229/us-east-1_localDev01`
- **Client ID**: `my-app-local`
- **Redirect URI**: `http://localhost:3000/callback`
- **Scope**: `openid email profile`

## Supported Auth Flows

- `USER_PASSWORD_AUTH` - Direct username/password authentication
- `REFRESH_TOKEN_AUTH` - Refresh token exchange
- Authorization Code with PKCE (via OIDC endpoints)
- Password grant (via OIDC token endpoint, for testing)

**Not supported**: `USER_SRP_AUTH` (returns a clear error message suggesting `USER_PASSWORD_AUTH` instead)

## Development

```bash
npm install
npm run dev     # Start with hot reload
npm test        # Run tests
npm run build   # Compile TypeScript
```

## License

Apache-2.0
