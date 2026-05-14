import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  AdminCreateUserCommand,
  AdminInitiateAuthCommand,
  AdminConfirmSignUpCommand,
  AdminSetUserPasswordCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  CreateGroupCommand,
  AdminAddUserToGroupCommand,
  AdminListGroupsForUserCommand,
  ListUsersInGroupCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  GetUserCommand,
  ChangePasswordCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GlobalSignOutCommand,
  ListUserPoolsCommand,
  DescribeUserPoolCommand,
  CreateUserPoolCommand,
  ListUserPoolClientsCommand,
  AddCustomAttributesCommand,
  DeleteUserCommand,
  RevokeTokenCommand,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand,
  SetUserMFAPreferenceCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import http from "http";
import { authenticator } from "otplib";
import type express from "express";
import { createTestApp, TEST_CLIENT_ID, TEST_POOL_ID } from "../setup";

let server: http.Server | undefined;
let endpoint = "";
let app: express.Express;

beforeEach(async () => {
  ({ app } = createTestApp());
  await new Promise<void>((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const addr = server!.address() as { port: number };
      endpoint = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterEach(() => {
  if (server) server.close();
  server = undefined;
});

function client(): CognitoIdentityProviderClient {
  return new CognitoIdentityProviderClient({
    region: "us-east-1",
    endpoint,
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });
}

describe("AWS SDK v3 integration", () => {
  it("end-to-end SDK flow against the real AWS SDK", async () => {
    const c = client();

    // SignUp
    const signUp = await c.send(
      new SignUpCommand({
        ClientId: TEST_CLIENT_ID,
        Username: "v3@example.com",
        Password: "Password1!",
        UserAttributes: [{ Name: "email", Value: "v3@example.com" }],
      })
    );
    expect(signUp.UserSub).toBeTruthy();

    // Admin confirm
    await c.send(
      new AdminConfirmSignUpCommand({
        UserPoolId: TEST_POOL_ID,
        Username: "v3@example.com",
      })
    );

    // InitiateAuth
    const auth = await c.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: {
          USERNAME: "v3@example.com",
          PASSWORD: "Password1!",
        },
      })
    );
    expect(auth.AuthenticationResult?.AccessToken).toBeTruthy();
    expect(auth.AuthenticationResult?.IdToken).toBeTruthy();
    expect(auth.AuthenticationResult?.RefreshToken).toBeTruthy();
    expect(auth.AuthenticationResult?.ExpiresIn).toBeTruthy();
  });

  it("groups + AdminListGroupsForUser via SDK (covers #405)", async () => {
    const c = client();

    await c.send(
      new CreateGroupCommand({
        UserPoolId: TEST_POOL_ID,
        GroupName: "sdk-admins",
        Description: "Admin group",
      })
    );

    await c.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: TEST_POOL_ID,
        Username: "test@example.com",
        GroupName: "sdk-admins",
      })
    );

    const result = await c.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: TEST_POOL_ID,
        Username: "test@example.com",
      })
    );
    expect(result.Groups).toHaveLength(1);
    expect(result.Groups?.[0].GroupName).toBe("sdk-admins");

    const inGroup = await c.send(
      new ListUsersInGroupCommand({
        UserPoolId: TEST_POOL_ID,
        GroupName: "sdk-admins",
      })
    );
    expect(inGroup.Users).toHaveLength(1);
  });

  it("AdminCreateUser + NEW_PASSWORD_REQUIRED challenge flow", async () => {
    const c = client();
    await c.send(
      new AdminCreateUserCommand({
        UserPoolId: TEST_POOL_ID,
        Username: "admincreate@example.com",
        UserAttributes: [
          { Name: "email", Value: "admincreate@example.com" },
        ],
        TemporaryPassword: "TempPass1!",
      })
    );

    const challenge = await c.send(
      new AdminInitiateAuthCommand({
        UserPoolId: TEST_POOL_ID,
        ClientId: TEST_CLIENT_ID,
        AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
        AuthParameters: {
          USERNAME: "admincreate@example.com",
          PASSWORD: "TempPass1!",
        },
      })
    );
    expect(challenge.ChallengeName).toBe("NEW_PASSWORD_REQUIRED");
    expect(challenge.Session).toBeTruthy();

    const final = await c.send(
      new RespondToAuthChallengeCommand({
        ClientId: TEST_CLIENT_ID,
        ChallengeName: "NEW_PASSWORD_REQUIRED",
        Session: challenge.Session!,
        ChallengeResponses: {
          USERNAME: "admincreate@example.com",
          NEW_PASSWORD: "FinalPass1!",
        },
      })
    );
    expect(final.AuthenticationResult?.AccessToken).toBeTruthy();
  });

  it("ForgotPassword + ConfirmForgotPassword flow", async () => {
    const c = client();
    await c.send(
      new ForgotPasswordCommand({
        ClientId: TEST_CLIENT_ID,
        Username: "test@example.com",
      })
    );

    // Use ctx access to peek confirmation code — production users would receive via lambda
    // For the SDK test we know the silentLogger doesn't expose it, so use ConfirmForgotPassword with the wrong code first
    const failed = c
      .send(
        new ConfirmForgotPasswordCommand({
          ClientId: TEST_CLIENT_ID,
          Username: "test@example.com",
          ConfirmationCode: "wrong",
          Password: "NewPass1!",
        })
      )
      .catch((e: { name: string }) => e);
    const err = await failed;
    expect((err as { name: string }).name).toBe("CodeMismatchException");
  });

  it("ListUserPools + DescribeUserPool + ListUserPoolClients + CreateUserPool", async () => {
    const c = client();

    const list = await c.send(new ListUserPoolsCommand({ MaxResults: 60 }));
    expect(list.UserPools?.length).toBeGreaterThan(0);

    const desc = await c.send(
      new DescribeUserPoolCommand({ UserPoolId: TEST_POOL_ID })
    );
    expect(desc.UserPool?.Id).toBe(TEST_POOL_ID);

    const clients = await c.send(
      new ListUserPoolClientsCommand({ UserPoolId: TEST_POOL_ID })
    );
    expect(clients.UserPoolClients?.length).toBeGreaterThan(0);

    const newPool = await c.send(
      new CreateUserPoolCommand({ PoolName: "sdk-created" })
    );
    expect(newPool.UserPool?.Id).toBeTruthy();
  });

  it("GetUser + ChangePassword + DeleteUser via access token", async () => {
    const c = client();
    const auth = await c.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: {
          USERNAME: "test@example.com",
          PASSWORD: "Password1!",
        },
      })
    );
    const accessToken = auth.AuthenticationResult!.AccessToken!;

    const me = await c.send(new GetUserCommand({ AccessToken: accessToken }));
    expect(me.Username).toBe("test-user-1");

    await c.send(
      new ChangePasswordCommand({
        AccessToken: accessToken,
        PreviousPassword: "Password1!",
        ProposedPassword: "NewPass1!",
      })
    );

    await c.send(new DeleteUserCommand({ AccessToken: accessToken }));
  });

  it("AdminDisableUser revokes refresh tokens (regression for #381)", async () => {
    const c = client();
    const auth = await c.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: {
          USERNAME: "test@example.com",
          PASSWORD: "Password1!",
        },
      })
    );
    const refresh = auth.AuthenticationResult!.RefreshToken!;

    await c.send(
      new AdminDisableUserCommand({
        UserPoolId: TEST_POOL_ID,
        Username: "test@example.com",
      })
    );

    const refreshAttempt = c
      .send(
        new InitiateAuthCommand({
          AuthFlow: "REFRESH_TOKEN_AUTH",
          ClientId: TEST_CLIENT_ID,
          AuthParameters: { REFRESH_TOKEN: refresh },
        })
      )
      .catch((e: { name: string }) => e);
    const err = await refreshAttempt;
    expect((err as { name: string }).name).toBe("NotAuthorizedException");

    // Re-enable to allow further tests
    await c.send(
      new AdminEnableUserCommand({
        UserPoolId: TEST_POOL_ID,
        Username: "test@example.com",
      })
    );
  });

  it("MFA / TOTP flow via SDK", async () => {
    const c = client();

    // Authenticate
    const auth = await c.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: {
          USERNAME: "test@example.com",
          PASSWORD: "Password1!",
        },
      })
    );
    const token = auth.AuthenticationResult!.AccessToken!;

    const assoc = await c.send(
      new AssociateSoftwareTokenCommand({ AccessToken: token })
    );
    const secret = assoc.SecretCode!;
    expect(secret).toBeTruthy();

    const code = authenticator.generate(secret);
    const verify = await c.send(
      new VerifySoftwareTokenCommand({
        AccessToken: token,
        UserCode: code,
      })
    );
    expect(verify.Status).toBe("SUCCESS");

    await c.send(
      new SetUserMFAPreferenceCommand({
        AccessToken: token,
        SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true },
      })
    );
  });

  it("AdminSetUserPassword + AddCustomAttributes + RevokeToken", async () => {
    const c = client();

    await c.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: TEST_POOL_ID,
        Username: "test@example.com",
        Password: "PermanentPass1!",
        Permanent: true,
      })
    );

    await c.send(
      new AddCustomAttributesCommand({
        UserPoolId: TEST_POOL_ID,
        CustomAttributes: [
          {
            Name: "tenant_id",
            AttributeDataType: "String",
          },
        ],
      })
    );

    const auth = await c.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: {
          USERNAME: "test@example.com",
          PASSWORD: "PermanentPass1!",
        },
      })
    );

    await c.send(
      new RevokeTokenCommand({
        Token: auth.AuthenticationResult!.RefreshToken!,
        ClientId: TEST_CLIENT_ID,
      })
    );
  });

  it("returns CognitoLocal#Unsupported with a clear message for unknown ops", async () => {
    // Send a raw request for an unsupported operation
    const res = await fetch(endpoint, {
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

  it("GlobalSignOut clears refresh tokens", async () => {
    const c = client();
    const auth = await c.send(
      new InitiateAuthCommand({
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: {
          USERNAME: "test@example.com",
          PASSWORD: "Password1!",
        },
      })
    );
    await c.send(
      new GlobalSignOutCommand({
        AccessToken: auth.AuthenticationResult!.AccessToken!,
      })
    );
    // refresh token should fail
    const e = await c
      .send(
        new InitiateAuthCommand({
          AuthFlow: "REFRESH_TOKEN_AUTH",
          ClientId: TEST_CLIENT_ID,
          AuthParameters: {
            REFRESH_TOKEN: auth.AuthenticationResult!.RefreshToken!,
          },
        })
      )
      .catch((err: { name: string }) => err);
    expect((e as { name: string }).name).toBe("NotAuthorizedException");
  });
});
