import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import type express from "express";
import { AppContext } from "../../src/index";
import { createTestApp, TEST_CLIENT_ID, TEST_POOL_ID } from "../setup";

const SDK_CONTENT_TYPE = "application/x-amz-json-1.1";
const TARGET_PREFIX = "AWSCognitoIdentityProviderService.";

function sdkRequest(
  app: express.Express,
  operation: string,
  body: Record<string, unknown>
) {
  return request(app)
    .post("/")
    .set("Content-Type", SDK_CONTENT_TYPE)
    .set("X-Amz-Target", `${TARGET_PREFIX}${operation}`)
    .send(JSON.stringify(body));
}

describe("SDK extended admin operations", () => {
  let app: express.Express;
  let ctx: AppContext;

  beforeEach(() => {
    ({ app, ctx } = createTestApp());
  });

  describe("AdminCreateUser", () => {
    it("creates a user in FORCE_CHANGE_PASSWORD status with a generated temp password", async () => {
      const res = await sdkRequest(app, "AdminCreateUser", {
        UserPoolId: TEST_POOL_ID,
        Username: "newadmin@example.com",
        UserAttributes: [
          { Name: "email", Value: "newadmin@example.com" },
          { Name: "given_name", Value: "New" },
        ],
      }).expect(200);
      expect(res.body.User.UserStatus).toBe("FORCE_CHANGE_PASSWORD");
      expect(res.body.User.Username).toBeTruthy();
    });

    it("returns UsernameExistsException when the email is taken", async () => {
      const res = await sdkRequest(app, "AdminCreateUser", {
        UserPoolId: TEST_POOL_ID,
        Username: "test@example.com",
        UserAttributes: [{ Name: "email", Value: "test@example.com" }],
      }).expect(400);
      expect(res.body.__type).toBe("UsernameExistsException");
    });
  });

  describe("AdminInitiateAuth", () => {
    it("authenticates with ADMIN_NO_SRP_AUTH", async () => {
      const res = await sdkRequest(app, "AdminInitiateAuth", {
        UserPoolId: TEST_POOL_ID,
        ClientId: TEST_CLIENT_ID,
        AuthFlow: "ADMIN_NO_SRP_AUTH",
        AuthParameters: {
          USERNAME: "test-user-1",
          PASSWORD: "Password1!",
        },
      }).expect(200);
      expect(res.body.AuthenticationResult.AccessToken).toBeTruthy();
    });

    it("returns NEW_PASSWORD_REQUIRED challenge for AdminCreateUser flow", async () => {
      await sdkRequest(app, "AdminCreateUser", {
        UserPoolId: TEST_POOL_ID,
        Username: "force@example.com",
        UserAttributes: [{ Name: "email", Value: "force@example.com" }],
        TemporaryPassword: "TempPass1!",
      }).expect(200);

      const res = await sdkRequest(app, "AdminInitiateAuth", {
        UserPoolId: TEST_POOL_ID,
        ClientId: TEST_CLIENT_ID,
        AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
        AuthParameters: {
          USERNAME: "force@example.com",
          PASSWORD: "TempPass1!",
        },
      }).expect(200);
      expect(res.body.ChallengeName).toBe("NEW_PASSWORD_REQUIRED");
      expect(res.body.Session).toBeTruthy();
    });
  });

  describe("AdminSetUserPassword", () => {
    it("sets a permanent password and CONFIRMS user", async () => {
      await sdkRequest(app, "AdminSetUserPassword", {
        UserPoolId: TEST_POOL_ID,
        Username: "test-user-2",
        Password: "NewPassword1!",
        Permanent: true,
      }).expect(200);

      const user = ctx.userPoolStore.getUser(TEST_POOL_ID, "test-user-2")!;
      expect(user.password).toBe("NewPassword1!");
      expect(user.status).toBe("CONFIRMED");
    });

    it("rejects a weak password per the pool's policy", async () => {
      const res = await sdkRequest(app, "AdminSetUserPassword", {
        UserPoolId: TEST_POOL_ID,
        Username: "test-user-1",
        Password: "weak",
        Permanent: true,
      }).expect(400);
      expect(res.body.__type).toBe("InvalidPasswordException");
    });
  });

  describe("AdminDisableUser (fixes #381)", () => {
    it("revokes refresh tokens on disable", async () => {
      // Sign in to mint a refresh token
      const authRes = await sdkRequest(app, "InitiateAuth", {
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: {
          USERNAME: "test-user-1",
          PASSWORD: "Password1!",
        },
      }).expect(200);
      const refresh = authRes.body.AuthenticationResult.RefreshToken;

      // Disable the user
      await sdkRequest(app, "AdminDisableUser", {
        UserPoolId: TEST_POOL_ID,
        Username: "test-user-1",
      }).expect(200);

      // Refresh-token exchange must fail
      const res = await sdkRequest(app, "InitiateAuth", {
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: { REFRESH_TOKEN: refresh },
      }).expect(400);
      expect(res.body.__type).toBe("NotAuthorizedException");

      // User's refreshTokens array is empty
      const user = ctx.userPoolStore.getUser(TEST_POOL_ID, "test-user-1")!;
      expect(user.refreshTokens).toHaveLength(0);
      expect(user.enabled).toBe(false);
    });
  });

  describe("AdminEnableUser", () => {
    it("re-enables a disabled user", async () => {
      await sdkRequest(app, "AdminDisableUser", {
        UserPoolId: TEST_POOL_ID,
        Username: "test-user-1",
      }).expect(200);
      await sdkRequest(app, "AdminEnableUser", {
        UserPoolId: TEST_POOL_ID,
        Username: "test-user-1",
      }).expect(200);
      const user = ctx.userPoolStore.getUser(TEST_POOL_ID, "test-user-1")!;
      expect(user.enabled).toBe(true);
    });
  });

  describe("AdminConfirmSignUp", () => {
    it("confirms an UNCONFIRMED user", async () => {
      await sdkRequest(app, "AdminConfirmSignUp", {
        UserPoolId: TEST_POOL_ID,
        Username: "test-user-2",
      }).expect(200);
      const user = ctx.userPoolStore.getUser(TEST_POOL_ID, "test-user-2")!;
      expect(user.status).toBe("CONFIRMED");
    });
  });

  describe("AdminUpdateUserAttributes (fixes #380)", () => {
    it("returns UserNotFoundException for non-existent user (not NotAuthorizedException)", async () => {
      const res = await sdkRequest(app, "AdminUpdateUserAttributes", {
        UserPoolId: TEST_POOL_ID,
        Username: "nonexistent",
        UserAttributes: [{ Name: "given_name", Value: "X" }],
      }).expect(400);
      expect(res.body.__type).toBe("UserNotFoundException");
    });
  });

  describe("AdminUserGlobalSignOut", () => {
    it("revokes all refresh tokens for a user", async () => {
      await sdkRequest(app, "InitiateAuth", {
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: {
          USERNAME: "test-user-1",
          PASSWORD: "Password1!",
        },
      }).expect(200);

      await sdkRequest(app, "AdminUserGlobalSignOut", {
        UserPoolId: TEST_POOL_ID,
        Username: "test-user-1",
      }).expect(200);

      const user = ctx.userPoolStore.getUser(TEST_POOL_ID, "test-user-1")!;
      expect(user.refreshTokens).toHaveLength(0);
    });
  });
});
