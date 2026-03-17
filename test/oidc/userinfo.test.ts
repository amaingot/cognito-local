import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import type express from "express";
import { createTestApp, TEST_CLIENT_ID, TEST_CLIENT_SECRET } from "../setup";

describe("OIDC UserInfo Endpoint", () => {
  let app: express.Express;

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it("returns user claims with a valid access token", async () => {
    // First obtain an access token
    const tokenRes = await request(app)
      .post("/oauth2/token")
      .type("form")
      .send({
        grant_type: "password",
        client_id: TEST_CLIENT_ID,
        client_secret: TEST_CLIENT_SECRET,
        username: "test@example.com",
        password: "Password1!",
      })
      .expect(200);

    const accessToken = tokenRes.body.access_token;

    const res = await request(app)
      .get("/oauth2/userInfo")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(res.body.sub).toBe("test-user-1");
    expect(res.body.email).toBe("test@example.com");
    expect(res.body.email_verified).toBe(true);
    expect(res.body.given_name).toBe("Test");
    expect(res.body.family_name).toBe("User");
    expect(res.body["cognito:username"]).toBe("test-user-1");
    expect(res.body["cognito:groups"]).toEqual(["TestGroup"]);
  });

  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app)
      .get("/oauth2/userInfo")
      .expect(401);

    expect(res.body.error).toBe("invalid_token");
  });

  it("returns 401 with an invalid token", async () => {
    const res = await request(app)
      .get("/oauth2/userInfo")
      .set("Authorization", "Bearer invalid-token-value")
      .expect(401);

    expect(res.body.error).toBe("invalid_token");
  });

  it("returns 401 with a malformed Authorization header", async () => {
    const res = await request(app)
      .get("/oauth2/userInfo")
      .set("Authorization", "NotBearer some-token")
      .expect(401);

    expect(res.body.error).toBe("invalid_token");
  });
});
