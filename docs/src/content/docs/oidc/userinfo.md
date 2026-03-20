---
title: UserInfo Endpoint
description: Retrieve claims about the authenticated user using a valid access token.
---

## GET /oauth2/userInfo

Returns claims about the authenticated user. Requires a valid access token.

### Request

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:9229/oauth2/userInfo
```

### Success Response (200)

```json
{
  "sub": "user-001",
  "email": "alice@example.com",
  "email_verified": true,
  "given_name": "Alice",
  "family_name": "Smith",
  "nickname": "alice",
  "cognito:username": "user-001",
  "cognito:groups": ["Admin", "Everyone"]
}
```

### Claims Returned

- **Always included:** `sub`, `email`, `email_verified`, `cognito:username`, `cognito:groups`
- **Included if set:** `name`, `nickname`, `given_name`, `family_name`, `phone_number`, `picture`, `locale`, `address`, `birthdate`, `gender`, `middle_name`, `preferred_username`, `profile`, `website`, `zoneinfo`

Undefined or empty attributes are omitted from the response.

### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `invalid_token` | Missing, malformed, or expired Bearer token |
| 404 | `user_not_found` | Token is valid but user no longer exists |
