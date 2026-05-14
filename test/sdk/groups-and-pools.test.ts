import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import type express from "express";
import { AppContext } from "../../src/index";
import { createTestApp, TEST_POOL_ID, TEST_CLIENT_ID } from "../setup";

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

describe("Groups and pool management", () => {
  let app: express.Express;
  let ctx: AppContext;

  beforeEach(() => {
    ({ app, ctx } = createTestApp());
  });

  describe("Groups", () => {
    it("creates, lists, updates, and deletes a group", async () => {
      await sdkRequest(app, "CreateGroup", {
        UserPoolId: TEST_POOL_ID,
        GroupName: "Admins",
        Description: "Admin group",
        Precedence: 1,
      }).expect(200);

      const list = await sdkRequest(app, "ListGroups", {
        UserPoolId: TEST_POOL_ID,
      }).expect(200);
      expect(list.body.Groups.length).toBeGreaterThan(0);

      await sdkRequest(app, "UpdateGroup", {
        UserPoolId: TEST_POOL_ID,
        GroupName: "Admins",
        Description: "Updated",
      }).expect(200);

      const get = await sdkRequest(app, "GetGroup", {
        UserPoolId: TEST_POOL_ID,
        GroupName: "Admins",
      }).expect(200);
      expect(get.body.Group.Description).toBe("Updated");

      await sdkRequest(app, "DeleteGroup", {
        UserPoolId: TEST_POOL_ID,
        GroupName: "Admins",
      }).expect(200);
    });

    it("AdminListGroupsForUser returns groups when pool uses email username (fixes #405)", async () => {
      // Create a group and add the email-aliased user to it
      await sdkRequest(app, "CreateGroup", {
        UserPoolId: TEST_POOL_ID,
        GroupName: "Editors",
      }).expect(200);

      // Add by email (the request input), which our store resolves to sub internally
      await sdkRequest(app, "AdminAddUserToGroup", {
        UserPoolId: TEST_POOL_ID,
        Username: "test@example.com",
        GroupName: "Editors",
      }).expect(200);

      // List groups using the email — must not return empty
      const res = await sdkRequest(app, "AdminListGroupsForUser", {
        UserPoolId: TEST_POOL_ID,
        Username: "test@example.com",
      }).expect(200);
      expect(res.body.Groups).toHaveLength(1);
      expect(res.body.Groups[0].GroupName).toBe("Editors");
    });

    it("AdminAddUserToGroup updates the user's groups list", async () => {
      await sdkRequest(app, "CreateGroup", {
        UserPoolId: TEST_POOL_ID,
        GroupName: "Editors",
      }).expect(200);
      await sdkRequest(app, "AdminAddUserToGroup", {
        UserPoolId: TEST_POOL_ID,
        Username: "test-user-1",
        GroupName: "Editors",
      }).expect(200);
      const user = ctx.userPoolStore.getUser(TEST_POOL_ID, "test-user-1")!;
      expect(user.groups).toContain("Editors");
    });

    it("ListUsersInGroup", async () => {
      await sdkRequest(app, "CreateGroup", {
        UserPoolId: TEST_POOL_ID,
        GroupName: "Members",
      }).expect(200);
      await sdkRequest(app, "AdminAddUserToGroup", {
        UserPoolId: TEST_POOL_ID,
        Username: "test-user-1",
        GroupName: "Members",
      }).expect(200);
      const res = await sdkRequest(app, "ListUsersInGroup", {
        UserPoolId: TEST_POOL_ID,
        GroupName: "Members",
      }).expect(200);
      expect(res.body.Users).toHaveLength(1);
    });
  });

  describe("Pool / client management", () => {
    it("ListUserPools returns the seeded pool", async () => {
      const res = await sdkRequest(app, "ListUserPools", {
        MaxResults: 60,
      }).expect(200);
      expect(res.body.UserPools.length).toBeGreaterThan(0);
    });

    it("UpdateUserPool changes MFA config", async () => {
      await sdkRequest(app, "UpdateUserPool", {
        UserPoolId: TEST_POOL_ID,
        MfaConfiguration: "OPTIONAL",
      }).expect(200);
      const pool = ctx.userPoolStore.getPool(TEST_POOL_ID)!;
      expect(pool.mfaConfiguration).toBe("OPTIONAL");
    });

    it("DescribeUserPoolClient + ListUserPoolClients", async () => {
      const desc = await sdkRequest(app, "DescribeUserPoolClient", {
        UserPoolId: TEST_POOL_ID,
        ClientId: TEST_CLIENT_ID,
      }).expect(200);
      expect(desc.body.UserPoolClient.ClientId).toBe(TEST_CLIENT_ID);

      const list = await sdkRequest(app, "ListUserPoolClients", {
        UserPoolId: TEST_POOL_ID,
      }).expect(200);
      expect(list.body.UserPoolClients.length).toBeGreaterThan(0);
    });
  });
});
