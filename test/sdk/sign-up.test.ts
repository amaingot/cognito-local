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
