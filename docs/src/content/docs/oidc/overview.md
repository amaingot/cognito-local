---
title: OIDC Endpoints Overview
description: Overview of the OpenID Connect provider surface in cognito-local, including all supported endpoints and features.
---

cognito-local provides a full OIDC-compliant provider surface that mirrors Amazon Cognito's Hosted UI. All OIDC endpoints are served by the same Express server alongside the SDK API, so there is no separate process or port to manage.

## Endpoints

| Endpoint | Method | Path | Description |
|----------|--------|------|-------------|
| Discovery | GET | `/{poolId}/.well-known/openid-configuration` | OpenID Connect discovery document |
| JWKS | GET | `/{poolId}/.well-known/jwks.json` | JSON Web Key Set |
| Authorize | GET | `/oauth2/authorize` | Authorization endpoint (renders login page) |
| Token | POST | `/oauth2/token` | Token exchange endpoint |
| UserInfo | GET | `/oauth2/userInfo` | User information endpoint |
| Logout | GET | `/logout` | End session endpoint |
| Revoke | POST | `/oauth2/revoke` | Token revocation endpoint |

`{poolId}` is the user pool ID configured in your `config.json` (e.g., `us-east-1_localDev01`).

## Supported Features

- Authorization Code flow with PKCE (S256)
- Password grant (for testing convenience)
- Refresh token grant
- Client authentication via Basic auth or POST body
- RS256 token signing
- Cognito-compatible JWT claims

## Not Supported

The following OIDC/OAuth2 features are not implemented:

- **Implicit grant** (`response_type=token`) -- Use the authorization code flow with PKCE instead.
- **Client credentials grant** (`grant_type=client_credentials`) -- No machine-to-machine token issuance.
- **Social/federated login** -- The login page authenticates against pre-seeded users rather than redirecting to external identity providers.

See [Scope & Limitations](../scope/) for the full list of unsupported features.
