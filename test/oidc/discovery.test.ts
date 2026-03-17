import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import type express from "express";
import { createTestApp, TEST_POOL_ID, TEST_ISSUER_HOST } from "../setup";

describe("OIDC Discovery", () => {
  let app: express.Express;

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it("GET /{poolId}/.well-known/openid-configuration returns 200 with correct structure", async () => {
    const res = await request(app)
      .get(`/${TEST_POOL_ID}/.well-known/openid-configuration`)
      .expect(200);

    const body = res.body;
    expect(body.issuer).toBe(`${TEST_ISSUER_HOST}/${TEST_POOL_ID}`);
    expect(body.authorization_endpoint).toBe(`${TEST_ISSUER_HOST}/oauth2/authorize`);
    expect(body.token_endpoint).toBe(`${TEST_ISSUER_HOST}/oauth2/token`);
    expect(body.userinfo_endpoint).toBe(`${TEST_ISSUER_HOST}/oauth2/userInfo`);
    expect(body.end_session_endpoint).toBe(`${TEST_ISSUER_HOST}/logout`);
    expect(body.revocation_endpoint).toBe(`${TEST_ISSUER_HOST}/oauth2/revoke`);

    expect(body.response_types_supported).toEqual(["code"]);
    expect(body.subject_types_supported).toEqual(["public"]);
    expect(body.id_token_signing_alg_values_supported).toEqual(["RS256"]);
    expect(body.scopes_supported).toEqual(["openid", "email", "phone", "profile"]);
    expect(body.token_endpoint_auth_methods_supported).toEqual([
      "client_secret_basic",
      "client_secret_post",
    ]);
    expect(body.grant_types_supported).toEqual([
      "authorization_code",
      "password",
      "refresh_token",
    ]);
    expect(body.code_challenge_methods_supported).toEqual(["S256"]);
    expect(body.claims_supported).toContain("sub");
    expect(body.claims_supported).toContain("email");
    expect(body.claims_supported).toContain("cognito:username");
    expect(body.claims_supported).toContain("cognito:groups");
  });

  it("returns correct JWKS URI", async () => {
    const res = await request(app)
      .get(`/${TEST_POOL_ID}/.well-known/openid-configuration`)
      .expect(200);

    expect(res.body.jwks_uri).toBe(
      `${TEST_ISSUER_HOST}/${TEST_POOL_ID}/.well-known/jwks.json`
    );
  });

  it("JWKS endpoint returns a key with expected properties", async () => {
    const res = await request(app)
      .get(`/${TEST_POOL_ID}/.well-known/jwks.json`)
      .expect(200);

    expect(res.body.keys).toHaveLength(1);
    const key = res.body.keys[0];
    expect(key.kty).toBe("RSA");
    expect(key.use).toBe("sig");
    expect(key.alg).toBe("RS256");
    expect(key.kid).toBeDefined();
    expect(key.n).toBeDefined();
    expect(key.e).toBeDefined();
  });
});
