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

describe("SDK SignUp and ConfirmSignUp", () => {
  let app: express.Express;
  let ctx: AppContext;

  beforeEach(() => {
    ({ app, ctx } = createTestApp());
  });

  describe("SignUp", () => {
    it("creates an unconfirmed user with email as username", async () => {
      const res = await sdkRequest(app, "SignUp", {
        ClientId: TEST_CLIENT_ID,
        Username: "newuser",
        Password: "NewPassword1!",
        UserAttributes: [
          { Name: "email", Value: "newuser@example.com" },
          { Name: "given_name", Value: "New" },
        ],
      }).expect(200);

      expect(res.body.UserConfirmed).toBe(false);
      expect(res.body.UserSub).toBe("newuser@example.com");

      // Verify the user was created as UNCONFIRMED in the store
      const user = ctx.userPoolStore.getUserByEmail(
        TEST_POOL_ID,
        "newuser@example.com"
      );
      expect(user).toBeDefined();
      expect(user!.username).toBe("newuser@example.com");
      expect(user!.status).toBe("UNCONFIRMED");
      expect(user!.attributes.email_verified).toBe("false");
      expect(user!.attributes.given_name).toBe("New");
    });

    it("returns UsernameExistsException for duplicate email", async () => {
      const res = await sdkRequest(app, "SignUp", {
        ClientId: TEST_CLIENT_ID,
        Username: "another-user",
        Password: "Password1!",
        UserAttributes: [{ Name: "email", Value: "test@example.com" }],
      }).expect(400);

      expect(res.body.__type).toBe("UsernameExistsException");
    });

    it("returns InvalidParameterException when email attribute is missing", async () => {
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
        Username: "user",
        Password: "Password1!",
        UserAttributes: [{ Name: "email", Value: "x@example.com" }],
      }).expect(400);

      expect(res.body.__type).toBe("ResourceNotFoundException");
    });

    it("generates a UUID username when pool does not use email as username attribute", async () => {
      // Override the pool to NOT include "email" in usernameAttributes
      ctx.userPoolStore.createPool({
        id: TEST_POOL_ID,
        name: "test-pool",
        region: "us-east-1",
        usernameAttributes: [],
        schema: [
          { name: "email", attributeDataType: "String", required: true, mutable: true },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await sdkRequest(app, "SignUp", {
        ClientId: TEST_CLIENT_ID,
        Username: "uuiduser",
        Password: "Password1!",
        UserAttributes: [
          { Name: "email", Value: "uuiduser@example.com" },
          { Name: "given_name", Value: "UUID" },
        ],
      }).expect(200);

      expect(res.body.UserConfirmed).toBe(false);

      // UserSub should be a UUID, not the email
      const userSub = res.body.UserSub;
      expect(userSub).not.toBe("uuiduser@example.com");
      expect(userSub).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );

      // Verify the user was stored with the UUID username but correct email attribute
      const user = ctx.userPoolStore.getUserByEmail(
        TEST_POOL_ID,
        "uuiduser@example.com"
      );
      expect(user).toBeDefined();
      expect(user!.username).toBe(userSub);
      expect(user!.email).toBe("uuiduser@example.com");
      expect(user!.status).toBe("UNCONFIRMED");
      expect(user!.attributes.email).toBe("uuiduser@example.com");
      expect(user!.attributes.email_verified).toBe("false");
      expect(user!.attributes.given_name).toBe("UUID");
    });
  });

  describe("ConfirmSignUp", () => {
    it("confirms user with correct confirmation code", async () => {
      await sdkRequest(app, "ConfirmSignUp", {
        ClientId: TEST_CLIENT_ID,
        Username: "test-user-2",
        ConfirmationCode: "123456",
      }).expect(200);

      // Verify user is now confirmed
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
        Username: "does-not-exist",
        ConfirmationCode: "123456",
      }).expect(400);

      expect(res.body.__type).toBe("UserNotFoundException");
    });

    it("falls back to getUserByEmail when username differs from email", async () => {
      // Create a user directly in the store whose username is NOT the email.
      // This forces the fallback path: getUser(poolId, email) will miss because
      // the store key is poolId:uuid-style-username, but getUserByEmail will
      // find the user by scanning the email field.
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
        userPoolId: TEST_POOL_ID,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Verify that getUser by email does NOT find the user (proving fallback is needed)
      const directLookup = ctx.userPoolStore.getUser(TEST_POOL_ID, "fallback@example.com");
      expect(directLookup).toBeUndefined();

      // ConfirmSignUp with email as Username should succeed via getUserByEmail fallback
      await sdkRequest(app, "ConfirmSignUp", {
        ClientId: TEST_CLIENT_ID,
        Username: "fallback@example.com",
        ConfirmationCode: "654321",
      }).expect(200);

      // Verify the user is now confirmed
      const confirmedUser = ctx.userPoolStore.getUser(TEST_POOL_ID, nonEmailUsername);
      expect(confirmedUser).toBeDefined();
      expect(confirmedUser!.status).toBe("CONFIRMED");
      expect(confirmedUser!.attributes.email_verified).toBe("true");
      expect(confirmedUser!.confirmationCode).toBeUndefined();
    });

    it("SignUp then ConfirmSignUp flow works end-to-end", async () => {
      // Sign up new user
      const signUpRes = await sdkRequest(app, "SignUp", {
        ClientId: TEST_CLIENT_ID,
        Username: "flow-user",
        Password: "FlowPassword1!",
        UserAttributes: [{ Name: "email", Value: "flow@example.com" }],
      }).expect(200);

      // With usernameAttributes: ["email"], UserSub is the email
      expect(signUpRes.body.UserSub).toBe("flow@example.com");

      // Get the confirmation code from the store
      const user = ctx.userPoolStore.getUser(TEST_POOL_ID, "flow@example.com");
      expect(user).toBeDefined();
      expect(user!.confirmationCode).toBeDefined();
      const code = user!.confirmationCode!;

      // Confirm sign up using email as Username
      await sdkRequest(app, "ConfirmSignUp", {
        ClientId: TEST_CLIENT_ID,
        Username: "flow@example.com",
        ConfirmationCode: code,
      }).expect(200);

      // Verify confirmed
      const confirmedUser = ctx.userPoolStore.getUser(TEST_POOL_ID, "flow@example.com");
      expect(confirmedUser!.status).toBe("CONFIRMED");
    });
  });
});
