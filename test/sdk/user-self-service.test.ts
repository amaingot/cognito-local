import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import type express from "express";
import { AppContext } from "../../src/index";
import { createTestApp, TEST_CLIENT_ID } from "../setup";

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

async function authenticate(app: express.Express): Promise<string> {
  const res = await sdkRequest(app, "InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: TEST_CLIENT_ID,
    AuthParameters: {
      USERNAME: "test-user-1",
      PASSWORD: "Password1!",
    },
  }).expect(200);
  return res.body.AuthenticationResult.AccessToken;
}

describe("SDK user self-service operations", () => {
  let app: express.Express;
  let ctx: AppContext;

  beforeEach(() => {
    ({ app, ctx } = createTestApp());
  });

  describe("GetUser", () => {
    it("returns user attributes when given a valid access token", async () => {
      const token = await authenticate(app);
      const res = await sdkRequest(app, "GetUser", {
        AccessToken: token,
      }).expect(200);

      expect(res.body.Username).toBe("test-user-1");
      const email = res.body.UserAttributes.find(
        (a: { Name: string }) => a.Name === "email"
      );
      expect(email.Value).toBe("test@example.com");
    });

    it("returns NotAuthorizedException for an invalid token", async () => {
      const res = await sdkRequest(app, "GetUser", {
        AccessToken: "garbage.token.here",
      }).expect(400);
      expect(res.body.__type).toBe("NotAuthorizedException");
    });
  });

  describe("UpdateUserAttributes", () => {
    it("updates self attributes", async () => {
      const token = await authenticate(app);
      await sdkRequest(app, "UpdateUserAttributes", {
        AccessToken: token,
        UserAttributes: [{ Name: "given_name", Value: "Updated" }],
      }).expect(200);

      const user = ctx.userPoolStore.getUser(
        ctx.config.pools[0].id,
        "test-user-1"
      )!;
      expect(user.attributes.given_name).toBe("Updated");
    });
  });

  describe("ChangePassword", () => {
    it("changes the user's password", async () => {
      const token = await authenticate(app);
      await sdkRequest(app, "ChangePassword", {
        AccessToken: token,
        PreviousPassword: "Password1!",
        ProposedPassword: "NewPassword1!",
      }).expect(200);

      const user = ctx.userPoolStore.getUser(
        ctx.config.pools[0].id,
        "test-user-1"
      )!;
      expect(user.password).toBe("NewPassword1!");
    });

    it("rejects when previous password is wrong", async () => {
      const token = await authenticate(app);
      const res = await sdkRequest(app, "ChangePassword", {
        AccessToken: token,
        PreviousPassword: "wrong",
        ProposedPassword: "NewPassword1!",
      }).expect(400);
      expect(res.body.__type).toBe("NotAuthorizedException");
    });

    it("rejects a password that fails the policy", async () => {
      const token = await authenticate(app);
      const res = await sdkRequest(app, "ChangePassword", {
        AccessToken: token,
        PreviousPassword: "Password1!",
        ProposedPassword: "short",
      }).expect(400);
      expect(res.body.__type).toBe("InvalidPasswordException");
    });
  });

  describe("ForgotPassword + ConfirmForgotPassword", () => {
    it("completes the forgot-password flow", async () => {
      const fp = await sdkRequest(app, "ForgotPassword", {
        ClientId: TEST_CLIENT_ID,
        Username: "test@example.com",
      }).expect(200);
      expect(fp.body.CodeDeliveryDetails.DeliveryMedium).toBe("EMAIL");

      const user = ctx.userPoolStore.getUser(
        ctx.config.pools[0].id,
        "test-user-1"
      )!;
      const code = user.confirmationCode!;

      await sdkRequest(app, "ConfirmForgotPassword", {
        ClientId: TEST_CLIENT_ID,
        Username: "test@example.com",
        ConfirmationCode: code,
        Password: "NewPassword1!",
      }).expect(200);

      const after = ctx.userPoolStore.getUser(
        ctx.config.pools[0].id,
        "test-user-1"
      )!;
      expect(after.password).toBe("NewPassword1!");
      expect(after.status).toBe("CONFIRMED");
    });

    it("returns CodeMismatchException for wrong code", async () => {
      await sdkRequest(app, "ForgotPassword", {
        ClientId: TEST_CLIENT_ID,
        Username: "test@example.com",
      }).expect(200);

      const res = await sdkRequest(app, "ConfirmForgotPassword", {
        ClientId: TEST_CLIENT_ID,
        Username: "test@example.com",
        ConfirmationCode: "wrong",
        Password: "NewPassword1!",
      }).expect(400);
      expect(res.body.__type).toBe("CodeMismatchException");
    });
  });

  describe("DeleteUser", () => {
    it("deletes the authenticated user", async () => {
      const token = await authenticate(app);
      await sdkRequest(app, "DeleteUser", { AccessToken: token }).expect(200);
      const after = ctx.userPoolStore.getUser(
        ctx.config.pools[0].id,
        "test-user-1"
      );
      expect(after).toBeUndefined();
    });
  });

  describe("DeleteUserAttributes", () => {
    it("removes specified attributes", async () => {
      const token = await authenticate(app);
      await sdkRequest(app, "DeleteUserAttributes", {
        AccessToken: token,
        UserAttributeNames: ["given_name"],
      }).expect(200);
      const user = ctx.userPoolStore.getUser(
        ctx.config.pools[0].id,
        "test-user-1"
      )!;
      expect(user.attributes.given_name).toBeUndefined();
    });
  });

  describe("GlobalSignOut", () => {
    it("revokes all refresh tokens for the user", async () => {
      // Sign in twice to have multiple refresh tokens
      await authenticate(app);
      const token = await authenticate(app);

      const userBefore = ctx.userPoolStore.getUser(
        ctx.config.pools[0].id,
        "test-user-1"
      )!;
      expect(userBefore.refreshTokens.length).toBeGreaterThan(0);

      await sdkRequest(app, "GlobalSignOut", { AccessToken: token }).expect(
        200
      );

      const userAfter = ctx.userPoolStore.getUser(
        ctx.config.pools[0].id,
        "test-user-1"
      )!;
      expect(userAfter.refreshTokens).toHaveLength(0);
    });
  });

  describe("RevokeToken (SDK)", () => {
    it("revokes a refresh token so it can no longer be used", async () => {
      const res1 = await sdkRequest(app, "InitiateAuth", {
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: {
          USERNAME: "test-user-1",
          PASSWORD: "Password1!",
        },
      }).expect(200);
      const refresh = res1.body.AuthenticationResult.RefreshToken;

      await sdkRequest(app, "RevokeToken", { Token: refresh }).expect(200);

      const res2 = await sdkRequest(app, "InitiateAuth", {
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: { REFRESH_TOKEN: refresh },
      }).expect(400);
      expect(res2.body.__type).toBe("NotAuthorizedException");
    });
  });

  describe("GetUserAttributeVerificationCode + VerifyUserAttribute", () => {
    it("issues and verifies an attribute verification code", async () => {
      const token = await authenticate(app);

      await sdkRequest(app, "GetUserAttributeVerificationCode", {
        AccessToken: token,
        AttributeName: "email",
      }).expect(200);

      const user = ctx.userPoolStore.getUser(
        ctx.config.pools[0].id,
        "test-user-1"
      )!;
      const code = user.attributeVerificationCode!;

      await sdkRequest(app, "VerifyUserAttribute", {
        AccessToken: token,
        AttributeName: "email",
        Code: code,
      }).expect(200);

      const after = ctx.userPoolStore.getUser(
        ctx.config.pools[0].id,
        "test-user-1"
      )!;
      expect(after.attributes.email_verified).toBe("true");
    });
  });
});
