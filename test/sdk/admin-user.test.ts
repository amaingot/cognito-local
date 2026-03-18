import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import type express from "express";
import { createTestApp, TEST_POOL_ID } from "../setup";

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

describe("SDK Admin User Operations", () => {
  let app: express.Express;
  beforeEach(() => {
    ({ app } = createTestApp());
  });

  describe("AdminGetUser", () => {
    it("returns user attributes for an existing user", async () => {
      const res = await sdkRequest(app, "AdminGetUser", {
        UserPoolId: TEST_POOL_ID,
        Username: "test-user-1",
      }).expect(200);

      expect(res.body.Username).toBe("test-user-1");
      expect(res.body.UserStatus).toBe("CONFIRMED");
      expect(res.body.Enabled).toBe(true);
      expect(res.body.UserCreateDate).toBeDefined();
      expect(res.body.UserLastModifiedDate).toBeDefined();

      const attrs = res.body.UserAttributes as Array<{
        Name: string;
        Value: string;
      }>;
      const emailAttr = attrs.find((a) => a.Name === "email");
      expect(emailAttr).toBeDefined();
      expect(emailAttr!.Value).toBe("test@example.com");

      const givenNameAttr = attrs.find((a) => a.Name === "given_name");
      expect(givenNameAttr).toBeDefined();
      expect(givenNameAttr!.Value).toBe("Test");

      const familyNameAttr = attrs.find((a) => a.Name === "family_name");
      expect(familyNameAttr).toBeDefined();
      expect(familyNameAttr!.Value).toBe("User");
    });

    it("returns UserNotFoundException for non-existent user", async () => {
      const res = await sdkRequest(app, "AdminGetUser", {
        UserPoolId: TEST_POOL_ID,
        Username: "does-not-exist",
      }).expect(400);

      expect(res.body.__type).toBe("UserNotFoundException");
    });

    it("returns ResourceNotFoundException for non-existent pool", async () => {
      const res = await sdkRequest(app, "AdminGetUser", {
        UserPoolId: "us-east-1_nonExistent",
        Username: "test-user-1",
      }).expect(400);

      expect(res.body.__type).toBe("ResourceNotFoundException");
    });
  });

  describe("AdminUpdateUserAttributes", () => {
    it("updates user attributes", async () => {
      await sdkRequest(app, "AdminUpdateUserAttributes", {
        UserPoolId: TEST_POOL_ID,
        Username: "test-user-1",
        UserAttributes: [
          { Name: "given_name", Value: "Updated" },
          { Name: "nickname", Value: "Testy" },
        ],
      }).expect(200);

      // Verify update via AdminGetUser
      const res = await sdkRequest(app, "AdminGetUser", {
        UserPoolId: TEST_POOL_ID,
        Username: "test-user-1",
      }).expect(200);

      const attrs = res.body.UserAttributes as Array<{
        Name: string;
        Value: string;
      }>;
      const givenNameAttr = attrs.find((a) => a.Name === "given_name");
      expect(givenNameAttr!.Value).toBe("Updated");

      const nicknameAttr = attrs.find((a) => a.Name === "nickname");
      expect(nicknameAttr).toBeDefined();
      expect(nicknameAttr!.Value).toBe("Testy");
    });

    it("returns UserNotFoundException for non-existent user", async () => {
      const res = await sdkRequest(app, "AdminUpdateUserAttributes", {
        UserPoolId: TEST_POOL_ID,
        Username: "does-not-exist",
        UserAttributes: [{ Name: "given_name", Value: "X" }],
      }).expect(400);

      expect(res.body.__type).toBe("UserNotFoundException");
    });
  });

  describe("AdminDeleteUserAttributes", () => {
    it("removes specified attributes", async () => {
      await sdkRequest(app, "AdminDeleteUserAttributes", {
        UserPoolId: TEST_POOL_ID,
        Username: "test-user-1",
        UserAttributeNames: ["given_name", "family_name"],
      }).expect(200);

      // Verify removal
      const res = await sdkRequest(app, "AdminGetUser", {
        UserPoolId: TEST_POOL_ID,
        Username: "test-user-1",
      }).expect(200);

      const attrs = res.body.UserAttributes as Array<{
        Name: string;
        Value: string;
      }>;
      const givenNameAttr = attrs.find((a) => a.Name === "given_name");
      expect(givenNameAttr).toBeUndefined();

      const familyNameAttr = attrs.find((a) => a.Name === "family_name");
      expect(familyNameAttr).toBeUndefined();

      // Other attributes should remain
      const emailAttr = attrs.find((a) => a.Name === "email");
      expect(emailAttr).toBeDefined();
    });

    it("returns UserNotFoundException for non-existent user", async () => {
      const res = await sdkRequest(app, "AdminDeleteUserAttributes", {
        UserPoolId: TEST_POOL_ID,
        Username: "does-not-exist",
        UserAttributeNames: ["given_name"],
      }).expect(400);

      expect(res.body.__type).toBe("UserNotFoundException");
    });
  });

  describe("AdminDeleteUser", () => {
    it("removes a user", async () => {
      await sdkRequest(app, "AdminDeleteUser", {
        UserPoolId: TEST_POOL_ID,
        Username: "test-user-1",
      }).expect(200);

      // Verify user is gone
      const res = await sdkRequest(app, "AdminGetUser", {
        UserPoolId: TEST_POOL_ID,
        Username: "test-user-1",
      }).expect(400);

      expect(res.body.__type).toBe("UserNotFoundException");
    });

    it("returns UserNotFoundException for non-existent user", async () => {
      const res = await sdkRequest(app, "AdminDeleteUser", {
        UserPoolId: TEST_POOL_ID,
        Username: "does-not-exist",
      }).expect(400);

      expect(res.body.__type).toBe("UserNotFoundException");
    });
  });

  describe("ListUsers", () => {
    it("returns all users in the pool", async () => {
      const res = await sdkRequest(app, "ListUsers", {
        UserPoolId: TEST_POOL_ID,
      }).expect(200);

      expect(res.body.Users).toBeDefined();
      expect(res.body.Users.length).toBe(2);

      const usernames = res.body.Users.map(
        (u: { Username: string }) => u.Username
      );
      expect(usernames).toContain("test-user-1");
      expect(usernames).toContain("test-user-2");
    });

    it("filters users by attribute", async () => {
      const res = await sdkRequest(app, "ListUsers", {
        UserPoolId: TEST_POOL_ID,
        Filter: 'email="test@example.com"',
      }).expect(200);

      expect(res.body.Users).toHaveLength(1);
      expect(res.body.Users[0].Username).toBe("test-user-1");
    });

    it("returns empty array when filter matches no users", async () => {
      const res = await sdkRequest(app, "ListUsers", {
        UserPoolId: TEST_POOL_ID,
        Filter: 'email="nobody@example.com"',
      }).expect(200);

      expect(res.body.Users).toHaveLength(0);
    });

    it("returns ResourceNotFoundException for non-existent pool", async () => {
      const res = await sdkRequest(app, "ListUsers", {
        UserPoolId: "us-east-1_nonExistent",
      }).expect(400);

      expect(res.body.__type).toBe("ResourceNotFoundException");
    });
  });
});
