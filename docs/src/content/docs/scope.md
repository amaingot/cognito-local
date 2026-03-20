---
title: Scope & Limitations
description: What cognito-local supports and what it does not. Understand the emulator's coverage before integrating it into your workflow.
---

cognito-local implements the Cognito features most commonly needed for local development and testing. It does not replicate the full breadth of AWS Cognito's 130+ API operations and managed infrastructure features. This page provides a clear map of what is and is not covered.

## What Is Supported

| Category | Details |
|----------|---------|
| **SDK Operations** | 12 operations: [SignUp, ConfirmSignUp, ResendConfirmationCode](/sdk/registration/), [InitiateAuth](/sdk/authentication/), [AdminGetUser, AdminUpdateUserAttributes, AdminDeleteUserAttributes, AdminDeleteUser](/sdk/admin-operations/), [ListUsers](/sdk/admin-operations/), [DescribeUserPool, CreateUserPool, CreateUserPoolClient](/sdk/pool-management/) |
| **OIDC Endpoints** | [Discovery, JWKS](/oidc/discovery/), [Authorization](/oidc/authorization/), [Token](/oidc/token/), [UserInfo](/oidc/userinfo/), [Logout, Revoke](/oidc/logout-revoke/) |
| **Auth Flows** | [USER_PASSWORD_AUTH](/auth-flows/user-password-auth/), [REFRESH_TOKEN_AUTH](/auth-flows/refresh-token-auth/), [Authorization Code + PKCE](/auth-flows/authorization-code-pkce/), [Password Grant](/auth-flows/password-grant/) |
| **Tokens** | RS256-signed JWTs, Cognito-compatible claims (`cognito:groups`, `cognito:username`, `token_use`), JWKS endpoint |
| **Data** | Persistent user/pool/client storage (JSON files), [pre-seeded users](/configuration/users-file/) from config |

## What Is Not Supported

### Authentication Flows

- **USER_SRP_AUTH** -- Secure Remote Password protocol. cognito-local returns a helpful error suggesting [USER_PASSWORD_AUTH](/auth-flows/user-password-auth/) instead.
- **ADMIN_USER_PASSWORD_AUTH / ADMIN_NO_SRP_AUTH** -- Server-side admin authentication flows.
- **CUSTOM_AUTH** -- Custom challenge/response flows backed by Lambda triggers.

### Multi-Factor Authentication (MFA)

- **TOTP setup and verification** -- `AssociateSoftwareToken`, `VerifySoftwareToken`, `SetUserMFAPreference`
- **SMS-based MFA** -- SMS code delivery and verification.
- **MFA challenge responses** -- `RespondToAuthChallenge` with SMS_MFA or SOFTWARE_TOKEN_MFA challenges.
- **AdminSetUserMFAPreference** -- Admin-level MFA configuration.

### Password Management

- **ForgotPassword / ConfirmForgotPassword** -- Self-service password reset flow.
- **ChangePassword** -- Authenticated password change.
- **AdminSetUserPassword** -- Admin-initiated password reset.
- **AdminResetUserPassword** -- Force password reset on next sign-in.

### User Management Operations

- **AdminCreateUser** -- Admin-initiated user creation with temporary passwords and welcome emails.
- **AdminInitiateAuth / AdminRespondToAuthChallenge** -- Server-side authentication with challenge support.
- **AdminConfirmSignUp** -- Admin-side user confirmation (the client-side `ConfirmSignUp` is supported).
- **AdminEnableUser / AdminDisableUser** -- Enable or disable user accounts.
- **GetUser** -- Client-side self-service user info retrieval (use `AdminGetUser` instead).
- **UpdateUserAttributes / DeleteUserAttributes** -- Client-side self-service attribute management (use the Admin variants instead).
- **DeleteUser** -- Client-side self-service account deletion (use `AdminDeleteUser` instead).
- **GlobalSignOut / AdminUserGlobalSignOut** -- Invalidate all tokens for a user.

### Groups API

Groups can be assigned to users via [`users.json`](/configuration/users-file/) and appear in the `cognito:groups` token claim, but there is no runtime API for managing them.

- **CreateGroup / DeleteGroup / UpdateGroup / GetGroup / ListGroups** -- Group CRUD operations.
- **AdminAddUserToGroup / AdminRemoveUserFromGroup** -- Group membership management.
- **AdminListGroupsForUser / ListUsersInGroup** -- Group membership queries.

### User Pool & Client Lifecycle

- **UpdateUserPool / DeleteUserPool** -- Modify or remove user pools at runtime.
- **UpdateUserPoolClient / DeleteUserPoolClient** -- Modify or remove app clients at runtime.
- **DescribeUserPoolClient / ListUserPoolClients** -- Query app client details.
- **ListUserPools** -- List all user pools.

### Identity Providers & Federation

- **CreateIdentityProvider / UpdateIdentityProvider / DeleteIdentityProvider / ListIdentityProviders** -- External identity provider configuration.
- **SAML, OIDC, and social providers** (Google, Facebook, Apple, Amazon) -- Federated sign-in.
- **AdminLinkProviderForUser / AdminUnlinkProviderFromUser** -- Link external identities to Cognito users.

### Lambda Triggers

None of the Cognito Lambda trigger points are implemented:

- Pre sign-up, Post sign-up
- Pre authentication, Post authentication
- Pre token generation / V2
- Custom message
- User migration
- Define auth challenge, Create auth challenge, Verify auth challenge response

### User Attribute Verification

- **VerifyUserAttribute** -- Verify an email or phone number attribute.
- **GetUserAttributeVerificationCode** -- Request a verification code for an attribute.

### Resource Servers & Custom Scopes

- **CreateResourceServer / UpdateResourceServer / DeleteResourceServer / DescribeResourceServer** -- Custom OAuth2 resource servers.
- **Custom OAuth scopes** -- Only standard OIDC scopes (`openid`, `email`, `profile`) are supported.

### User Pool Domains

- **CreateUserPoolDomain / UpdateUserPoolDomain / DeleteUserPoolDomain / DescribeUserPoolDomain** -- Custom domain configuration for the Hosted UI.

### Advanced Security

- **Risk-based adaptive authentication** -- Threat-level scoring and automatic responses.
- **Device tracking and remembering** -- `ConfirmDevice`, `GetDevice`, `ListDevices`, etc.
- **Compromised credentials detection** -- Checking passwords against known breaches.

### User Import/Export

- **CreateUserImportJob / StartUserImportJob / DescribeUserImportJob / ListUserImportJobs** -- Bulk CSV user import.
- **GetCSVHeader** -- Get CSV template for user import.

### OIDC Grant Types

- **Implicit grant** (`response_type=token`) -- Use the [authorization code flow with PKCE](/auth-flows/authorization-code-pkce/) instead.
- **Client credentials grant** (`grant_type=client_credentials`) -- Machine-to-machine token issuance.

## Workarounds

### SRP Authentication

Most AWS SDKs default to SRP. Switch to `USER_PASSWORD_AUTH` for local development:

```javascript
const command = new InitiateAuthCommand({
  AuthFlow: process.env.NODE_ENV === 'development'
    ? 'USER_PASSWORD_AUTH'
    : 'USER_SRP_AUTH',
  ClientId: CLIENT_ID,
  AuthParameters: {
    USERNAME: username,
    PASSWORD: password,
  },
});
```

### MFA

Skip MFA checks in local/test environments by gating MFA logic with an environment flag in your application code.

### Password Resets

Update user passwords directly in `users.json` and restart the emulator, or use `AdminDeleteUser` followed by `SignUp` to recreate the user.

### Groups

Define groups statically in [`users.json`](/configuration/users-file/). They appear in the `cognito:groups` token claim. No runtime API is needed if your group assignments are fixed for testing.

### Lambda Triggers

Implement trigger logic as middleware in your application and test it separately. For integration testing against real triggers, use AWS Cognito directly.

### Federation / Social Login

Use the built-in OIDC flow with [pre-seeded users](/configuration/users-file/) for local development. Test federation against real Cognito or a separate OIDC provider mock.

## Need a Missing Feature?

cognito-local is designed to be easy to extend. The SDK handler pattern is straightforward: a factory function, a router registration, and a test file.

- **[Adding SDK Operations](/contributing/adding-sdk-operations/)** -- Step-by-step guide for implementing new operations.
- **[Development Setup](/contributing/development/)** -- Get the project running locally.
- **[GitHub Issues](https://github.com/amaingot/cognito-local/issues)** -- Request features or report bugs.

For production-like integration testing that requires unsupported features, consider using real AWS Cognito or [LocalStack](https://localstack.cloud/).
