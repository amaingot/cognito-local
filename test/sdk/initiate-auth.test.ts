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

describe("SDK InitiateAuth", () => {
  let app: express.Express;
  let ctx: AppContext;

  beforeEach(() => {
    ({ app, ctx } = createTestApp());
  });

  describe("USER_PASSWORD_AUTH", () => {
    it("returns AuthenticationResult with valid credentials", async () => {
      const res = await sdkRequest(app, "InitiateAuth", {
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: {
          USERNAME: "test-user-1",
          PASSWORD: "Password1!",
        },
      }).expect(200);

      expect(res.body.AuthenticationResult).toBeDefined();
      expect(res.body.AuthenticationResult.AccessToken).toBeDefined();
      expect(res.body.AuthenticationResult.IdToken).toBeDefined();
      expect(res.body.AuthenticationResult.RefreshToken).toBeDefined();
      expect(res.body.AuthenticationResult.TokenType).toBe("Bearer");
      expect(res.body.AuthenticationResult.ExpiresIn).toBe(3600);
    });

    it("works with email as USERNAME", async () => {
      const res = await sdkRequest(app, "InitiateAuth", {
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: {
          USERNAME: "test@example.com",
          PASSWORD: "Password1!",
        },
      }).expect(200);

      expect(res.body.AuthenticationResult).toBeDefined();
      expect(res.body.AuthenticationResult.AccessToken).toBeDefined();
    });

    it("returns NotAuthorizedException with wrong password", async () => {
      const res = await sdkRequest(app, "InitiateAuth", {
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: {
          USERNAME: "test-user-1",
          PASSWORD: "WrongPassword!",
        },
      }).expect(400);

      expect(res.body.__type).toBe("NotAuthorizedException");
    });

    it("returns UserNotFoundException for non-existent user", async () => {
      const res = await sdkRequest(app, "InitiateAuth", {
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: {
          USERNAME: "nonexistent@example.com",
          PASSWORD: "Password1!",
        },
      }).expect(400);

      expect(res.body.__type).toBe("UserNotFoundException");
    });

    it("returns NotAuthorizedException for unconfirmed user", async () => {
      const res = await sdkRequest(app, "InitiateAuth", {
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: {
          USERNAME: "test-user-2",
          PASSWORD: "Password1!",
        },
      }).expect(400);

      expect(res.body.__type).toBe("NotAuthorizedException");
    });
  });

  describe("REFRESH_TOKEN_AUTH", () => {
    it("returns new tokens with a valid refresh token", async () => {
      // First, authenticate to get a refresh token
      const authRes = await sdkRequest(app, "InitiateAuth", {
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: {
          USERNAME: "test-user-1",
          PASSWORD: "Password1!",
        },
      }).expect(200);

      const refreshToken = authRes.body.AuthenticationResult.RefreshToken;

      // Now refresh
      const res = await sdkRequest(app, "InitiateAuth", {
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      }).expect(200);

      expect(res.body.AuthenticationResult).toBeDefined();
      expect(res.body.AuthenticationResult.AccessToken).toBeDefined();
      expect(res.body.AuthenticationResult.IdToken).toBeDefined();
      expect(res.body.AuthenticationResult.TokenType).toBe("Bearer");
      // Refresh token grant does not return a new refresh token
      expect(res.body.AuthenticationResult.RefreshToken).toBeUndefined();
    });

    it("returns NotAuthorizedException with invalid refresh token", async () => {
      const res = await sdkRequest(app, "InitiateAuth", {
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: {
          REFRESH_TOKEN: "invalid-refresh-token",
        },
      }).expect(400);

      expect(res.body.__type).toBe("NotAuthorizedException");
    });
  });

  describe("USER_SRP_AUTH", () => {
    it("returns InvalidParameterException since SRP is not supported", async () => {
      const res = await sdkRequest(app, "InitiateAuth", {
        AuthFlow: "USER_SRP_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: {
          USERNAME: "test-user-1",
          SRP_A: "some-srp-value",
        },
      }).expect(400);

      expect(res.body.__type).toBe("InvalidParameterException");
    });
  });

  describe("missing parameters", () => {
    it("returns InvalidParameterException when AuthFlow is missing", async () => {
      const res = await sdkRequest(app, "InitiateAuth", {
        ClientId: TEST_CLIENT_ID,
        AuthParameters: {
          USERNAME: "test-user-1",
          PASSWORD: "Password1!",
        },
      }).expect(400);

      expect(res.body.__type).toBe("InvalidParameterException");
    });

    it("returns ResourceNotFoundException for unknown client", async () => {
      const res = await sdkRequest(app, "InitiateAuth", {
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: "nonexistent-client",
        AuthParameters: {
          USERNAME: "test-user-1",
          PASSWORD: "Password1!",
        },
      }).expect(400);

      expect(res.body.__type).toBe("ResourceNotFoundException");
    });
  });
});
