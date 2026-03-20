import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import type express from "express";
import { AppContext } from "../../src/index";
import {
  createTestApp,
  TEST_CLIENT_ID,
  TEST_CLIENT_SECRET,
  TEST_POOL_ID,
  TEST_ISSUER_HOST,
} from "../setup";

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

describe("Integration: Full Flows", () => {
  let app: express.Express;
  let ctx: AppContext;

  beforeEach(() => {
    ({ app, ctx } = createTestApp());
  });

  describe("SDK flow: SignUp -> ConfirmSignUp -> InitiateAuth -> AdminGetUser", () => {
    it("completes the full user lifecycle", async () => {
      // 1. Sign up a new user
      const signUpRes = await sdkRequest(app, "SignUp", {
        ClientId: TEST_CLIENT_ID,
        Username: "integration-user",
        Password: "IntegrationPass1!",
        UserAttributes: [
          { Name: "email", Value: "integration@example.com" },
          { Name: "given_name", Value: "Integration" },
          { Name: "family_name", Value: "Test" },
        ],
      }).expect(200);

      expect(signUpRes.body.UserConfirmed).toBe(false);
      // With usernameAttributes: ["email"], UserSub is the email
      const userSub = signUpRes.body.UserSub;
      expect(userSub).toBe("integration@example.com");

      // 2. Get the confirmation code from the store and confirm
      const unconfirmedUser = ctx.userPoolStore.getUser(TEST_POOL_ID, "integration@example.com");
      expect(unconfirmedUser).toBeDefined();
      expect(unconfirmedUser!.status).toBe("UNCONFIRMED");
      const confirmationCode = unconfirmedUser!.confirmationCode!;

      await sdkRequest(app, "ConfirmSignUp", {
        ClientId: TEST_CLIENT_ID,
        Username: "integration@example.com",
        ConfirmationCode: confirmationCode,
      }).expect(200);

      // 3. Authenticate the newly confirmed user
      const authRes = await sdkRequest(app, "InitiateAuth", {
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: TEST_CLIENT_ID,
        AuthParameters: {
          USERNAME: "integration@example.com",
          PASSWORD: "IntegrationPass1!",
        },
      }).expect(200);

      expect(authRes.body.AuthenticationResult).toBeDefined();
      expect(authRes.body.AuthenticationResult.AccessToken).toBeDefined();
      expect(authRes.body.AuthenticationResult.IdToken).toBeDefined();
      expect(authRes.body.AuthenticationResult.RefreshToken).toBeDefined();

      // 4. Admin get user to verify attributes
      const getUserRes = await sdkRequest(app, "AdminGetUser", {
        UserPoolId: TEST_POOL_ID,
        Username: "integration@example.com",
      }).expect(200);

      expect(getUserRes.body.Username).toBe("integration@example.com");
      expect(getUserRes.body.UserStatus).toBe("CONFIRMED");
      expect(getUserRes.body.Enabled).toBe(true);

      const attrs = getUserRes.body.UserAttributes as Array<{
        Name: string;
        Value: string;
      }>;
      const emailAttr = attrs.find((a) => a.Name === "email");
      expect(emailAttr!.Value).toBe("integration@example.com");
      const emailVerified = attrs.find((a) => a.Name === "email_verified");
      expect(emailVerified!.Value).toBe("true");
      const givenName = attrs.find((a) => a.Name === "given_name");
      expect(givenName!.Value).toBe("Integration");
    });
  });

  describe("OIDC flow: Discovery -> JWKS -> Token -> UserInfo", () => {
    it("completes the full OIDC flow", async () => {
      // 1. Discover endpoints
      const discoveryRes = await request(app)
        .get(`/${TEST_POOL_ID}/.well-known/openid-configuration`)
        .expect(200);

      expect(discoveryRes.body.issuer).toBe(
        `${TEST_ISSUER_HOST}/${TEST_POOL_ID}`
      );
      const jwksUri = discoveryRes.body.jwks_uri;
      expect(jwksUri).toBeDefined();

      // 2. Fetch JWKS and verify it has keys
      const jwksPath = `/${TEST_POOL_ID}/.well-known/jwks.json`;
      const jwksRes = await request(app).get(jwksPath).expect(200);

      expect(jwksRes.body.keys).toHaveLength(1);
      expect(jwksRes.body.keys[0].kty).toBe("RSA");
      expect(jwksRes.body.keys[0].alg).toBe("RS256");
      expect(jwksRes.body.keys[0].kid).toBeDefined();

      // 3. Obtain tokens via password grant
      const tokenRes = await request(app)
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

      expect(tokenRes.body.access_token).toBeDefined();
      expect(tokenRes.body.id_token).toBeDefined();
      expect(tokenRes.body.refresh_token).toBeDefined();
      expect(tokenRes.body.token_type).toBe("Bearer");

      // 4. Use access token to get user info
      const userInfoRes = await request(app)
        .get("/oauth2/userInfo")
        .set("Authorization", `Bearer ${tokenRes.body.access_token}`)
        .expect(200);

      expect(userInfoRes.body.sub).toBe("test-user-1");
      expect(userInfoRes.body.email).toBe("test@example.com");
      expect(userInfoRes.body.email_verified).toBe(true);
      expect(userInfoRes.body.given_name).toBe("Test");
      expect(userInfoRes.body.family_name).toBe("User");
      expect(userInfoRes.body["cognito:username"]).toBe("test-user-1");
      expect(userInfoRes.body["cognito:groups"]).toEqual(["TestGroup"]);
    });
  });
});
