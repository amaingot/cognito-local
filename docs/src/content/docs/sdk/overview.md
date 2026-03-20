---
title: SDK Operations Overview
description: AWS SDK-compatible API surface for cognito-local, supporting standard Cognito operations via X-Amz-Target header routing.
---

cognito-local exposes an AWS SDK-compatible API surface. All SDK operations are sent as `POST` requests to `/` with the operation specified in the `X-Amz-Target` header.

## Request Format

- **Method:** `POST /`
- **Content-Type:** `application/x-amz-json-1.1`
- **Header:** `X-Amz-Target: AWSCognitoIdentityProviderService.{OperationName}`
- **Body:** JSON

This is the same format used by the real AWS Cognito service, so any AWS SDK client (boto3, `@aws-sdk/client-cognito-identity-provider`, etc.) can be pointed at cognito-local by setting the endpoint URL.

## Supported Operations

| Operation | X-Amz-Target | Description |
|-----------|-------------|-------------|
| SignUp | `...SignUp` | Register a new user |
| ConfirmSignUp | `...ConfirmSignUp` | Confirm a user's registration |
| ResendConfirmationCode | `...ResendConfirmationCode` | Resend the confirmation code |
| InitiateAuth | `...InitiateAuth` | Authenticate a user |
| AdminGetUser | `...AdminGetUser` | Get user details (admin) |
| AdminUpdateUserAttributes | `...AdminUpdateUserAttributes` | Update user attributes (admin) |
| AdminDeleteUserAttributes | `...AdminDeleteUserAttributes` | Delete user attributes (admin) |
| AdminDeleteUser | `...AdminDeleteUser` | Delete a user (admin) |
| ListUsers | `...ListUsers` | List users with optional filter |
| DescribeUserPool | `...DescribeUserPool` | Get user pool details |
| CreateUserPool | `...CreateUserPool` | Create a new user pool |
| CreateUserPoolClient | `...CreateUserPoolClient` | Create a new app client |

## Error Format

All errors follow the Cognito error format:

```json
{
  "__type": "ErrorTypeName",
  "message": "Human-readable error message"
}
```

Common error types:

- `InvalidParameterException` -- Missing or invalid parameters
- `UserNotFoundException` -- User does not exist
- `NotAuthorizedException` -- Wrong credentials or user not confirmed
- `UsernameExistsException` -- Email/username already taken
- `ResourceNotFoundException` -- Pool or client not found
- `CodeMismatchException` -- Wrong confirmation code
- `InvalidAction` -- Unsupported operation

## Connecting AWS SDKs

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
```

### JavaScript (AWS SDK v3)

```javascript
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:9229',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});
```
