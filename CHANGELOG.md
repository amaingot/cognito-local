# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-beta.0] - 2026-05-13

cognito-local 1.0 covers the full AWS Cognito SDK surface, all 9 Lambda
trigger families, MFA / TOTP, multi-pool configuration, and a complete
OIDC / Hosted UI provider — all in a single Docker image.

### Breaking changes

- **New multi-pool config schema.** The old single-pool 0.x `config.json`
  shape is no longer accepted. Startup against a 0.x config now fails fast
  with a `ConfigMigrationError` pointing at
  [docs/migration/v1](docs/src/content/docs/migration/v1.md). There is no
  backwards-compatibility shim — see the migration guide for the new shape.

### Added

#### SDK surface

- **~98 new SDK operations** (~110 total), each routed via the
  `X-Amz-Target: AWSCognitoIdentityProviderService.*` header and exercised
  end-to-end against the real `@aws-sdk/client-cognito-identity-provider`.
- User self-service: `GetUser`, `UpdateUserAttributes`,
  `DeleteUserAttributes`, `VerifyUserAttribute`,
  `GetUserAttributeVerificationCode`, `ChangePassword`, `ForgotPassword`,
  `ConfirmForgotPassword`, `GlobalSignOut`, `DeleteUser`, `RevokeToken`.
- Admin lifecycle: `AdminCreateUser` (with `NEW_PASSWORD_REQUIRED` flow),
  `AdminInitiateAuth`, `AdminConfirmSignUp`, `AdminSetUserPassword`,
  `AdminDisableUser`, `AdminEnableUser`, `AdminResetUserPassword`,
  `AdminUserGlobalSignOut`, `AdminAddUserToGroup`,
  `AdminRemoveUserFromGroup`, `AdminListGroupsForUser`, and more.
- Pool / client management: `ListUserPools`, `UpdateUserPool`,
  `DeleteUserPool`, `DescribeUserPoolClient`, `ListUserPoolClients`,
  `UpdateUserPoolClient`, `DeleteUserPoolClient`.
- Groups: full CRUD (`CreateGroup`, `GetGroup`, `UpdateGroup`, `DeleteGroup`,
  `ListGroups`, `ListUsersInGroup`, and admin add/remove/list operations).
- Niche surfaces: identity providers, resource servers, domains, UI
  customization, device tracking, risk/event configuration, user-import jobs,
  resource tagging, and ~5 additional misc admin operations.
- Custom attributes: `AddCustomAttributes` and `dev:custom:` prefix support;
  `SignUp` now validates required custom attributes against the pool schema.

#### Lambda triggers

- **All 9 trigger families** wired through a new `TriggerService`:
  `PreSignUp`, `PostConfirmation`, `PreAuthentication`,
  `PostAuthentication`, `PreTokenGeneration` (V1 + V2),
  `UserMigration`, `CustomMessage`, `CustomEmailSender`, `CustomSMSSender`.
- `HttpLambdaInvoker` for `serverless-offline`-style local endpoints, and
  `AwsLambdaInvoker` using `@aws-sdk/client-lambda` v3 with the default
  credential provider chain (respects `AWS_PROFILE`).
- Pool-scoped trigger configuration (`pool.triggers`), not config-level.
- V2 `PreTokenGeneration` applies overrides to both the access token and
  the ID token.
- `PreSignUp` receives `ValidationData` from the request.
- `UserMigration` auto-fills `sub` if the trigger doesn't supply one.

#### MFA / TOTP

- `AssociateSoftwareToken`, `VerifySoftwareToken`,
  `SetUserMFAPreference` / `AdminSetUserMFAPreference`,
  `GetUserPoolMfaConfig` / `SetUserPoolMfaConfig`.
- `RespondToAuthChallenge` framework supporting `NEW_PASSWORD_REQUIRED`,
  `SMS_MFA`, `SOFTWARE_TOKEN_MFA`, `SELECT_MFA_TYPE`, and `MFA_SETUP`;
  every challenge response includes a `Session` token.
- TOTP backed by `otplib@^12`.

#### OIDC / OAuth2

- `client_credentials` OAuth2 grant on `/oauth2/token`.
- ALB-style `GET /:kid` public-keys endpoint that returns a PEM-encoded
  public key for the matching `kid`.
- Server-rendered login page for the Hosted UI surface.

#### Infrastructure

- New `CognitoError` hierarchy in [src/errors.ts](src/errors.ts) —
  handlers throw, the SDK router funnels into the right JSON status response.
- `cognitoJsonReplacer` on the SDK response boundary converts `Date` /
  ISO-string `*Date` fields to unix epoch seconds (the format AWS SDK v3
  expects).
- `AppContext` dependency-injection object replaces ad-hoc globals.
- Structured logging via `pino` / `pino-http` (with `pino-pretty` in dev).
- Injectable `Clock` service for deterministic tests.
- Optional HTTPS server.
- `/health` endpoint.
- `AWS SDK v3` integration test suite in
  [test/integration/aws-sdk-v3.test.ts](test/integration/aws-sdk-v3.test.ts)
  exercising the full lifecycle, groups, MFA, the `AdminCreateUser`
  challenge flow, the `AdminDisableUser` regression, and the
  `Unsupported` response shape.

### Changed (semantics now match real Cognito)

- `InitiateAuth` returns `NotAuthorizedException` for unknown users
  (previously `UserNotFoundException`).
- `USER_PASSWORD_AUTH` throws `UserNotConfirmedException` for `UNCONFIRMED`
  users (previously `NotAuthorizedException`).
- `AdminUpdateUserAttributes` throws `UserNotFoundException` for unknown
  users (previously `NotAuthorizedException`).
- `AdminDisableUser` clears stored refresh tokens; the refresh-token grant
  now rejects disabled users.
- `AdminListGroupsForUser` resolves the user first and filters by the
  resolved internal username (was previously filtering by the raw input
  and returning empty for email-username pools).
- `InitiateAuth` returns `ExpiresIn` alongside the tokens.
- `usernameCaseSensitive` per-pool flag is honored in lookups.
- `DeveloperOnlyAttribute=true` renders as `dev:custom:name`.
- `SignUp` now returns a real UUID for `UserSub`, matching production
  Cognito behavior (was previously the email).
- Internal types use `Date` and ISO strings; conversion to AWS-wire format
  happens at the response boundary.
- `USER_SRP_AUTH` is explicitly out of scope and returns `InvalidParameter`
  with a hint to use `USER_PASSWORD_AUTH`.

### Documentation

- New 1.0 [README.md](README.md).
- Rewritten [CLAUDE.md](CLAUDE.md) reflecting the new architecture.
- New migration guide:
  [docs/migration/v1](docs/src/content/docs/migration/v1.md).

[1.0.0-beta.0]: https://github.com/amaingot/cognito-local/releases/tag/v1.0.0-beta.0
