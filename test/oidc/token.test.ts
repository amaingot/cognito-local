import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import type express from "express";
import { AppContext } from "../../src/index";
import {
  createTestApp,
  TEST_CLIENT_ID,
  TEST_CLIENT_SECRET,
  TEST_POOL_ID,
} from "../setup";

describe("OIDC Token Endpoint", () => {
  let app: express.Express;
  let ctx: AppContext;

  beforeEach(() => {
    ({ app, ctx } = createTestApp());
  });

  describe("password grant", () => {
    it("returns tokens with valid credentials", async () => {
      const res = await request(app)
        .post("/oauth2/token")
        .type("form")
        .send({
          grant_type: "password",
          client_id: TEST_CLIENT_ID,
          client_secret: TEST_CLIENT_SECRET,
          username: "test@example.com",
          password: "Password1!",
          scope: "openid email profile",
        })
        .expect(200);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.id_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
      expect(res.body.token_type).toBe("Bearer");
      expect(res.body.expires_in).toBe(3600);
      expect(res.body.scope).toBeDefined();
    });

    it("returns tokens with Basic auth", async () => {
      const credentials = Buffer.from(
        `${TEST_CLIENT_ID}:${TEST_CLIENT_SECRET}`
      ).toString("base64");

      const res = await request(app)
        .post("/oauth2/token")
        .set("Authorization", `Basic ${credentials}`)
        .type("form")
        .send({
          grant_type: "password",
          username: "test@example.com",
          password: "Password1!",
        })
        .expect(200);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.id_token).toBeDefined();
    });

    it("returns 400 with invalid credentials", async () => {
      const res = await request(app)
        .post("/oauth2/token")
        .type("form")
        .send({
          grant_type: "password",
          client_id: TEST_CLIENT_ID,
          client_secret: TEST_CLIENT_SECRET,
          username: "test@example.com",
          password: "WrongPassword!",
        })
        .expect(400);

      expect(res.body.error).toBe("invalid_grant");
    });

    it("returns 400 with missing username", async () => {
      const res = await request(app)
        .post("/oauth2/token")
        .type("form")
        .send({
          grant_type: "password",
          client_id: TEST_CLIENT_ID,
          client_secret: TEST_CLIENT_SECRET,
          password: "Password1!",
        })
        .expect(400);

      expect(res.body.error).toBe("invalid_request");
    });
  });

  describe("refresh_token grant", () => {
    it("returns new tokens with a valid refresh token", async () => {
      // First obtain tokens via password grant
      const initial = await request(app)
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

      const refreshToken = initial.body.refresh_token;
      expect(refreshToken).toBeDefined();

      // Exchange refresh token for new tokens
      const res = await request(app)
        .post("/oauth2/token")
        .type("form")
        .send({
          grant_type: "refresh_token",
          client_id: TEST_CLIENT_ID,
          client_secret: TEST_CLIENT_SECRET,
          refresh_token: refreshToken,
        })
        .expect(200);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.id_token).toBeDefined();
      expect(res.body.token_type).toBe("Bearer");
    });

    it("returns 400 with an invalid refresh token", async () => {
      const res = await request(app)
        .post("/oauth2/token")
        .type("form")
        .send({
          grant_type: "refresh_token",
          client_id: TEST_CLIENT_ID,
          client_secret: TEST_CLIENT_SECRET,
          refresh_token: "invalid-refresh-token",
        })
        .expect(400);

      expect(res.body.error).toBe("invalid_grant");
    });
  });

  describe("authorization_code grant", () => {
    it("exchanges a valid auth code for tokens", async () => {
      // Create an auth code directly via the token store
      const code = ctx.tokenStore.createAuthCode(
        "test-user-1",
        TEST_CLIENT_ID,
        "http://localhost:3000/callback",
        "openid email profile"
      );

      const res = await request(app)
        .post("/oauth2/token")
        .type("form")
        .send({
          grant_type: "authorization_code",
          client_id: TEST_CLIENT_ID,
          client_secret: TEST_CLIENT_SECRET,
          code,
          redirect_uri: "http://localhost:3000/callback",
        })
        .expect(200);

      expect(res.body.access_token).toBeDefined();
      expect(res.body.id_token).toBeDefined();
      expect(res.body.refresh_token).toBeDefined();
      expect(res.body.token_type).toBe("Bearer");
    });

    it("returns 400 for a consumed/invalid code", async () => {
      const code = ctx.tokenStore.createAuthCode(
        "test-user-1",
        TEST_CLIENT_ID,
        "http://localhost:3000/callback",
        "openid"
      );

      // First exchange succeeds
      await request(app)
        .post("/oauth2/token")
        .type("form")
        .send({
          grant_type: "authorization_code",
          client_id: TEST_CLIENT_ID,
          client_secret: TEST_CLIENT_SECRET,
          code,
          redirect_uri: "http://localhost:3000/callback",
        })
        .expect(200);

      // Second exchange with same code fails
      const res = await request(app)
        .post("/oauth2/token")
        .type("form")
        .send({
          grant_type: "authorization_code",
          client_id: TEST_CLIENT_ID,
          client_secret: TEST_CLIENT_SECRET,
          code,
          redirect_uri: "http://localhost:3000/callback",
        })
        .expect(400);

      expect(res.body.error).toBe("invalid_grant");
    });

    it("returns 400 for mismatched redirect_uri", async () => {
      const code = ctx.tokenStore.createAuthCode(
        "test-user-1",
        TEST_CLIENT_ID,
        "http://localhost:3000/callback",
        "openid"
      );

      const res = await request(app)
        .post("/oauth2/token")
        .type("form")
        .send({
          grant_type: "authorization_code",
          client_id: TEST_CLIENT_ID,
          client_secret: TEST_CLIENT_SECRET,
          code,
          redirect_uri: "http://evil.com/callback",
        })
        .expect(400);

      expect(res.body.error).toBe("invalid_grant");
    });
  });

  describe("unsupported grant type", () => {
    it("returns 400 for an unsupported grant_type", async () => {
      const res = await request(app)
        .post("/oauth2/token")
        .type("form")
        .send({
          grant_type: "client_credentials",
          client_id: TEST_CLIENT_ID,
          client_secret: TEST_CLIENT_SECRET,
        })
        .expect(400);

      expect(res.body.error).toBe("unsupported_grant_type");
    });
  });
});
