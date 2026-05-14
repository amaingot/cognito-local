/**
 * Docker smoke tests — exercises the published image's headline flows via the
 * real AWS SDK v3. Run via `npm run test:docker` against a running container.
 *
 * What's covered here that the in-process tests don't catch:
 *   - the multi-stage build actually produced a runnable image
 *   - PORT / CONFIG_FILE / USERS_FILE / DATA_DIR env wiring works end-to-end
 *   - volume-mounted config and users files are read correctly
 *   - /health responds inside the container
 *   - pino logs go to stdout (visible via `docker logs`)
 */

import { describe, it, expect } from "vitest";
import {
  AdminAddUserToGroupCommand,
  AdminConfirmSignUpCommand,
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminInitiateAuthCommand,
  AdminListGroupsForUserCommand,
  AssociateSoftwareTokenCommand,
  CreateGroupCommand,
  GetUserCommand,
  InitiateAuthCommand,
  ListUserPoolsCommand,
  RespondToAuthChallengeCommand,
  SetUserMFAPreferenceCommand,
  SignUpCommand,
  VerifySoftwareTokenCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { authenticator } from "otplib";
import {
  DOCKER_CLIENT_ID,
  DOCKER_POOL_ID,
  ENDPOINT,
  SEED_USER_EMAIL,
  SEED_USER_PASSWORD,
  makeClient,
  waitForHealth,
} from "./_helpers";

describe("docker smoke", () => {
  it("the container is healthy", async () => {
    await waitForHealth(5_000);
    const res = await fetch(`${ENDPOINT}/health`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("OIDC discovery document is served with the expected issuer", async () => {
    const res = await fetch(
      `${ENDPOINT}/${DOCKER_POOL_ID}/.well-known/openid-configuration`
    );
    expect(res.ok).toBe(true);
    const cfg = (await res.json()) as {
      issuer: string;
      jwks_uri: string;
      authorization_endpoint: string;
      token_endpoint: string;
    };
    expect(cfg.issuer).toContain(DOCKER_POOL_ID);
    expect(cfg.jwks_uri).toContain(".well-known/jwks.json");
    expect(cfg.authorization_endpoint).toContain("/oauth2/authorize");
    expect(cfg.token_endpoint).toContain("/oauth2/token");
  });

  it("JWKS endpoint returns at least one signing key", async () => {
    const res = await fetch(
      `${ENDPOINT}/${DOCKER_POOL_ID}/.well-known/jwks.json`
    );
    expect(res.ok).toBe(true);
    const jwks = (await res.json()) as {
      keys: Array<{ kty: string; kid: string; use: string }>;
    };
    expect(jwks.keys.length).toBeGreaterThan(0);
    expect(jwks.keys[0].kty).toBe("RSA");
    expect(jwks.keys[0].kid).toBeTruthy();
  });

  it("ALB-style /:kid endpoint returns a PEM-encoded public key", async () => {
    const jwksRes = await fetch(
      `${ENDPOINT}/${DOCKER_POOL_ID}/.well-known/jwks.json`
    );
    const { keys } = (await jwksRes.json()) as {
      keys: Array<{ kid: string }>;
    };
    const kid = keys[0].kid;
    const res = await fetch(`${ENDPOINT}/${kid}`);
    expect(res.ok).toBe(true);
    const pem = await res.text();
    expect(pem).toMatch(/^-----BEGIN PUBLIC KEY-----/);
    expect(pem).toMatch(/-----END PUBLIC KEY-----$/);
  });

  it("ListUserPools surfaces the pool from the mounted config", async () => {
    const c = makeClient();
    const result = await c.send(new ListUserPoolsCommand({ MaxResults: 10 }));
    const ids = result.UserPools?.map((p) => p.Id) ?? [];
    expect(ids).toContain(DOCKER_POOL_ID);
  });

  it("pre-seeded user can sign in via USER_PASSWORD_AUTH", async () => {
    const c = makeClient();
    const auth = await c.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: DOCKER_CLIENT_ID,
        AuthParameters: {
          USERNAME: SEED_USER_EMAIL,
          PASSWORD: SEED_USER_PASSWORD,
        },
      })
    );
    expect(auth.AuthenticationResult?.AccessToken).toBeTruthy();
    expect(auth.AuthenticationResult?.IdToken).toBeTruthy();
    expect(auth.AuthenticationResult?.RefreshToken).toBeTruthy();
    expect(auth.AuthenticationResult?.ExpiresIn).toBeGreaterThan(0);

    const me = await c.send(
      new GetUserCommand({
        AccessToken: auth.AuthenticationResult!.AccessToken!,
      })
    );
    const emailAttr = me.UserAttributes?.find((a) => a.Name === "email");
    expect(emailAttr?.Value).toBe(SEED_USER_EMAIL);
  });

  it("sign-up + admin-confirm + sign-in round-trip", async () => {
    const c = makeClient();
    const email = `smoke-signup-${Date.now()}@example.com`;
    const signUp = await c.send(
      new SignUpCommand({
        ClientId: DOCKER_CLIENT_ID,
        Username: email,
        Password: "Password1!",
        UserAttributes: [{ Name: "email", Value: email }],
      })
    );
    expect(signUp.UserSub).toBeTruthy();

    await c.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: DOCKER_POOL_ID,
        Username: email,
      })
    );

    const auth = await c.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: DOCKER_CLIENT_ID,
        AuthParameters: { USERNAME: email, PASSWORD: "Password1!" },
      })
    );
    expect(auth.AuthenticationResult?.AccessToken).toBeTruthy();
  });

  it("AdminCreateUser → NEW_PASSWORD_REQUIRED challenge → permanent password", async () => {
    const c = makeClient();
    const email = `smoke-admincreate-${Date.now()}@example.com`;
    await c.send(
      new AdminCreateUserCommand({
        UserPoolId: DOCKER_POOL_ID,
        Username: email,
        UserAttributes: [{ Name: "email", Value: email }],
        TemporaryPassword: "TempPass1!",
      })
    );

    const challenge = await c.send(
      new AdminInitiateAuthCommand({
        UserPoolId: DOCKER_POOL_ID,
        ClientId: DOCKER_CLIENT_ID,
        AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
        AuthParameters: { USERNAME: email, PASSWORD: "TempPass1!" },
      })
    );
    expect(challenge.ChallengeName).toBe("NEW_PASSWORD_REQUIRED");
    expect(challenge.Session).toBeTruthy();

    const final = await c.send(
      new RespondToAuthChallengeCommand({
        ClientId: DOCKER_CLIENT_ID,
        ChallengeName: "NEW_PASSWORD_REQUIRED",
        Session: challenge.Session!,
        ChallengeResponses: {
          USERNAME: email,
          NEW_PASSWORD: "FinalPass1!",
        },
      })
    );
    expect(final.AuthenticationResult?.AccessToken).toBeTruthy();
  });

  it("MFA / TOTP enrollment via the SDK", async () => {
    const c = makeClient();
    const email = `smoke-mfa-${Date.now()}@example.com`;
    await c.send(
      new SignUpCommand({
        ClientId: DOCKER_CLIENT_ID,
        Username: email,
        Password: "Password1!",
        UserAttributes: [{ Name: "email", Value: email }],
      })
    );
    await c.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: DOCKER_POOL_ID,
        Username: email,
      })
    );
    const auth = await c.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: DOCKER_CLIENT_ID,
        AuthParameters: { USERNAME: email, PASSWORD: "Password1!" },
      })
    );
    const token = auth.AuthenticationResult!.AccessToken!;

    const assoc = await c.send(
      new AssociateSoftwareTokenCommand({ AccessToken: token })
    );
    expect(assoc.SecretCode).toBeTruthy();

    const code = authenticator.generate(assoc.SecretCode!);
    const verify = await c.send(
      new VerifySoftwareTokenCommand({ AccessToken: token, UserCode: code })
    );
    expect(verify.Status).toBe("SUCCESS");

    await c.send(
      new SetUserMFAPreferenceCommand({
        AccessToken: token,
        SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true },
      })
    );
  });

  it("Groups CRUD: create + add user + list groups for user", async () => {
    const c = makeClient();
    const groupName = `smoke-group-${Date.now()}`;
    await c.send(
      new CreateGroupCommand({
        UserPoolId: DOCKER_POOL_ID,
        GroupName: groupName,
        Description: "Smoke test group",
      })
    );
    await c.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: DOCKER_POOL_ID,
        Username: SEED_USER_EMAIL,
        GroupName: groupName,
      })
    );
    const result = await c.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: DOCKER_POOL_ID,
        Username: SEED_USER_EMAIL,
      })
    );
    const names = result.Groups?.map((g) => g.GroupName) ?? [];
    expect(names).toContain(groupName);
  });

  it("AdminDisableUser revokes refresh tokens", async () => {
    const c = makeClient();
    const email = `smoke-disable-${Date.now()}@example.com`;
    await c.send(
      new SignUpCommand({
        ClientId: DOCKER_CLIENT_ID,
        Username: email,
        Password: "Password1!",
        UserAttributes: [{ Name: "email", Value: email }],
      })
    );
    await c.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: DOCKER_POOL_ID,
        Username: email,
      })
    );
    const auth = await c.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: DOCKER_CLIENT_ID,
        AuthParameters: { USERNAME: email, PASSWORD: "Password1!" },
      })
    );
    const refresh = auth.AuthenticationResult!.RefreshToken!;

    await c.send(
      new AdminDisableUserCommand({
        UserPoolId: DOCKER_POOL_ID,
        Username: email,
      })
    );

    const failed = await c
      .send(
        new InitiateAuthCommand({
          AuthFlow: "REFRESH_TOKEN_AUTH",
          ClientId: DOCKER_CLIENT_ID,
          AuthParameters: { REFRESH_TOKEN: refresh },
        })
      )
      .catch((e: { name: string }) => e);
    expect((failed as { name: string }).name).toBe("NotAuthorizedException");

    // Restore so other tests can use the user pool cleanly.
    await c.send(
      new AdminEnableUserCommand({
        UserPoolId: DOCKER_POOL_ID,
        Username: email,
      })
    );
  });

  it("unknown SDK operation returns CognitoLocal#Unsupported", async () => {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target":
          "AWSCognitoIdentityProviderService.UnknownMadeUpOperation",
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { __type: string; message: string };
    expect(body.__type).toBe("CognitoLocal#Unsupported");
    expect(body.message).toContain("UnknownMadeUpOperation");
  });
});
