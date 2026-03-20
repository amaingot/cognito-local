---
title: Discovery & JWKS
description: OpenID Connect discovery document and JSON Web Key Set endpoints for cognito-local.
---

## OpenID Connect Discovery

`GET /{poolId}/.well-known/openid-configuration`

Returns the standard OIDC discovery document. Clients and libraries use this endpoint to auto-configure themselves against the provider.

### Example Response

```json
{
  "issuer": "http://localhost:9229/us-east-1_localDev01",
  "authorization_endpoint": "http://localhost:9229/oauth2/authorize",
  "token_endpoint": "http://localhost:9229/oauth2/token",
  "userinfo_endpoint": "http://localhost:9229/oauth2/userInfo",
  "jwks_uri": "http://localhost:9229/us-east-1_localDev01/.well-known/jwks.json",
  "end_session_endpoint": "http://localhost:9229/logout",
  "revocation_endpoint": "http://localhost:9229/oauth2/revoke",
  "response_types_supported": ["code"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "scopes_supported": ["openid", "email", "phone", "profile"],
  "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post"],
  "claims_supported": ["sub", "iss", "aud", "exp", "iat", "email", "email_verified", "name", "nickname", "given_name", "family_name", "cognito:username", "cognito:groups"],
  "code_challenge_methods_supported": ["S256"],
  "grant_types_supported": ["authorization_code", "password", "refresh_token"]
}
```

### Example Request

```bash
curl http://localhost:9229/us-east-1_localDev01/.well-known/openid-configuration
```

## JWKS Endpoint

`GET /{poolId}/.well-known/jwks.json`

Returns the public RSA key used to verify JWT signatures. The key uses the RS256 algorithm. The JWK includes `kid`, `use: "sig"`, `alg: "RS256"`, and the RSA key components (`n`, `e`, `kty`).

### Example Response

```json
{
  "keys": [
    {
      "kty": "RSA",
      "n": "...",
      "e": "AQAB",
      "kid": "cognito-local-key-1",
      "use": "sig",
      "alg": "RS256"
    }
  ]
}
```

The RSA key pair is generated on first startup and persisted to `{dataDir}/keys.json`. It survives container restarts as long as the data directory is mounted as a volume.
