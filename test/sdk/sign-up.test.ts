import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import type express from "express";
import { AppContext } from "../../src/index";
import { createTestApp, TEST_CLIENT_ID, TEST_POOL_ID } from "../setup";
import { DEFAULT_PASSWORD_POLICY } from "../../src/types";

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

describe("SDK SignUp and ConfirmSignUp", () => {
  let app: express.Express;
  let ctx: AppContext;

  beforeEach(() => {
    ({ app, ctx } = createTestApp());
  });

  describe("SignUp", () => {
    it("creates an unconfirmed user with a UUID sub when pool uses email username", async () => {
      const res = await sdkRequest(app, "SignUp", {
        ClientId: TEST_CLIENT_ID,
        Username: "newuser@example.com",
        Password: "NewPassword1!",
        UserAttributes: [
          { Name: "email", Value: "newuser@example.com" },
          { Name: "given_name", Value: "New" },
        ],
      }).expect(200);

      expect(res.body.UserConfirmed).toBe(false);
      // Real Cognito returns a UUID as UserSub for email-username pools
      expect(res.body.UserSub).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );

      const user = ctx.userPoolStore.getUserByEmail(
        TEST_POOL_ID,
        "newuser@example.com"
      );
      expect(user).toBeDefined();
      expect(user!.username).toBe(res.body.UserSub);
      expect(user!.status).toBe("UNCONFIRMED");
      expect(user!.attributes.email_verified).toBe("false");
      expect(user!.attributes.given_name).toBe("New");
    });

    it("returns UsernameExistsException for duplicate email", async () => {
      const res = await sdkRequest(app, "SignUp", {
        ClientId: TEST_CLIENT_ID,
        Username: "test@example.com",
        Password: "Password1!",
        UserAttributes: [{ Name: "email", Value: "test@example.com" }],
      }).expect(400);

      expect(res.body.__type).toBe("UsernameExistsException");
    });

    it("returns InvalidParameterException when email-username pool gets a non-email username", async () => {
      const res = await sdkRequest(app, "SignUp", {
        ClientId: TEST_CLIENT_ID,
        Username: "nomail",
        Password: "Password1!",
        UserAttributes: [{ Name: "given_name", Value: "No" }],
      }).expect(400);

      expect(res.body.__type).toBe("InvalidParameterException");
    });

    it("returns ResourceNotFoundException for unknown client", async () => {
      const res = await sdkRequest(app, "SignUp", {
        ClientId: "nonexistent-client",
        Username: "user@example.com",
        Password: "Password1!",
        UserAttributes: [{ Name: "email", Value: "x@example.com" }],
      }).expect(400);

      expect(res.body.__type).toBe("ResourceNotFoundException");
    });

    it("rejects a password that fails the pool's policy", async () => {
      const res = await sdkRequest(app, "SignUp", {
        ClientId: TEST_CLIENT_ID,
        Username: "weakpass@example.com",
        Password: "short",
        UserAttributes: [{ Name: "email", Value: "weakpass@example.com" }],
      }).expect(400);
      expect(res.body.__type).toBe("InvalidPasswordException");
    });

    it("enforces required schema attributes (fixes #431)", async () => {
      // Add a pool with phone_number as required
      ctx.userPoolStore.createPool({
        id: "us-east-1_strictPool",
        name: "strict",
        region: "us-east-1",
        usernameAttributes: ["email"],
        usernameCaseSensitive: false,
        autoVerifiedAttributes: ["email"],
        mfaConfiguration: "OFF",
        passwordPolicy: DEFAULT_PASSWORD_POLICY,
        schema: [
          {
            name: "email",
            attributeDataType: "String",
            required: true,
            mutable: true,
            developerOnlyAttribute: false,
          },
          {
            name: "phone_number",
            attributeDataType: "String",
            required: true,
            mutable: true,
            developerOnlyAttribute: false,
          },
        ],
        createdAt: ctx.clock.now(),
        updatedAt: ctx.clock.now(),
      });
      ctx.clientStore.createClient({
        clientId: "strict-client",
        clientName: "strict",
        userPoolId: "us-east-1_strictPool",
        callbackUrls: [],
        logoutUrls: [],
        explicitAuthFlows: ["ALLOW_USER_PASSWORD_AUTH"],
        allowedOAuthFlows: [],
        allowedOAuthScopes: [],
        accessTokenValidity: 3600,
        idTokenValidity: 3600,
        refreshTokenValidity: 30 * 24 * 3600,
        createdAt: ctx.clock.now(),
        updatedAt: ctx.clock.now(),
      });

      const res = await sdkRequest(app, "SignUp", {
        ClientId: "strict-client",
        Username: "strict@example.com",
        Password: "Password1!",
        UserAttributes: [{ Name: "email", Value: "strict@example.com" }],
      }).expect(400);
      expect(res.body.__type).toBe("InvalidParameterException");
      expect(res.body.message).toContain("phone_number");
    });

    it("generates a UUID username when pool does not use email as username", async () => {
      ctx.userPoolStore.createPool({
        id: "us-east-1_nonEmailPool",
        name: "non-email",
        region: "us-east-1",
        usernameAttributes: [],
        usernameCaseSensitive: true,
        autoVerifiedAttributes: ["email"],
        mfaConfiguration: "OFF",
        passwordPolicy: DEFAULT_PASSWORD_POLICY,
        schema: [
          {
            name: "email",
            attributeDataType: "String",
            required: true,
            mutable: true,
            developerOnlyAttribute: false,
          },
        ],
        createdAt: ctx.clock.now(),
        updatedAt: ctx.clock.now(),
      });
      ctx.clientStore.createClient({
        clientId: "non-email-client",
        clientName: "ne",
        userPoolId: "us-east-1_nonEmailPool",
        callbackUrls: [],
        logoutUrls: [],
        explicitAuthFlows: ["ALLOW_USER_PASSWORD_AUTH"],
        allowedOAuthFlows: [],
        allowedOAuthScopes: [],
        accessTokenValidity: 3600,
        idTokenValidity: 3600,
        refreshTokenValidity: 30 * 24 * 3600,
        createdAt: ctx.clock.now(),
        updatedAt: ctx.clock.now(),
      });

      const res = await sdkRequest(app, "SignUp", {
        ClientId: "non-email-client",
        Username: "uuiduser",
        Password: "Password1!",
        UserAttributes: [
          { Name: "email", Value: "uuiduser@example.com" },
        ],
      }).expect(200);

      // Stored under "uuiduser" because pool doesn't use email-as-username
      const user = ctx.userPoolStore.getUser(
        "us-east-1_nonEmailPool",
        "uuiduser"
      );
      expect(user).toBeDefined();
      expect(user!.username).toBe("uuiduser");
      // UserSub is still a generated UUID
      expect(res.body.UserSub).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });

  describe("ConfirmSignUp", () => {
    it("confirms user with correct confirmation code", async () => {
      await sdkRequest(app, "ConfirmSignUp", {
        ClientId: TEST_CLIENT_ID,
        Username: "test-user-2",
        ConfirmationCode: "123456",
      }).expect(200);

      const user = ctx.userPoolStore.getUser(TEST_POOL_ID, "test-user-2");
      expect(user).toBeDefined();
      expect(user!.status).toBe("CONFIRMED");
      expect(user!.attributes.email_verified).toBe("true");
      expect(user!.confirmationCode).toBeUndefined();
    });

    it("returns CodeMismatchException with wrong code", async () => {
      const res = await sdkRequest(app, "ConfirmSignUp", {
        ClientId: TEST_CLIENT_ID,
        Username: "test-user-2",
        ConfirmationCode: "999999",
      }).expect(400);
      expect(res.body.__type).toBe("CodeMismatchException");
    });

    it("returns UserNotFoundException for non-existent user", async () => {
      const res = await sdkRequest(app, "ConfirmSignUp", {
        ClientId: TEST_CLIENT_ID,
        Username: "does-not-exist@example.com",
        ConfirmationCode: "123456",
      }).expect(400);
      expect(res.body.__type).toBe("UserNotFoundException");
    });

    it("resolves email aliases when pool uses email-as-username", async () => {
      // Create a user directly with a sub-style username and email
      const nonEmailUsername = "uuid-style-username-1234";
      ctx.userPoolStore.createUser({
        username: nonEmailUsername,
        email: "fallback@example.com",
        password: "Password1!",
        attributes: {
          sub: nonEmailUsername,
          email: "fallback@example.com",
          email_verified: "false",
        },
        groups: [],
        status: "UNCONFIRMED",
        enabled: true,
        confirmationCode: "654321",
        refreshTokens: [],
        userPoolId: TEST_POOL_ID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // ConfirmSignUp by email (the alias) — resolves to user via getUserByUsername
      await sdkRequest(app, "ConfirmSignUp", {
        ClientId: TEST_CLIENT_ID,
        Username: "fallback@example.com",
        ConfirmationCode: "654321",
      }).expect(200);

      const after = ctx.userPoolStore.getUser(TEST_POOL_ID, nonEmailUsername);
      expect(after!.status).toBe("CONFIRMED");
    });

    it("SignUp then ConfirmSignUp end-to-end with email-username pool", async () => {
      const signUpRes = await sdkRequest(app, "SignUp", {
        ClientId: TEST_CLIENT_ID,
        Username: "flow@example.com",
        Password: "FlowPassword1!",
        UserAttributes: [{ Name: "email", Value: "flow@example.com" }],
      }).expect(200);

      const sub = signUpRes.body.UserSub;
      const user = ctx.userPoolStore.getUser(TEST_POOL_ID, sub);
      expect(user).toBeDefined();
      const code = user!.confirmationCode!;

      // Confirm using the email alias
      await sdkRequest(app, "ConfirmSignUp", {
        ClientId: TEST_CLIENT_ID,
        Username: "flow@example.com",
        ConfirmationCode: code,
      }).expect(200);

      const after = ctx.userPoolStore.getUser(TEST_POOL_ID, sub);
      expect(after!.status).toBe("CONFIRMED");
    });
  });
});
