import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import type express from "express";
import { authenticator } from "otplib";
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

async function authenticate(app: express.Express): Promise<string> {
  const res = await sdkRequest(app, "InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: TEST_CLIENT_ID,
    AuthParameters: {
      USERNAME: "test-user-1",
      PASSWORD: "Password1!",
    },
  }).expect(200);
  return res.body.AuthenticationResult.AccessToken;
}

describe("MFA / TOTP", () => {
  let app: express.Express;

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it("end-to-end TOTP enrollment + sign-in", async () => {
    // Set pool to OPTIONAL MFA so per-user enrollment is honored
    await sdkRequest(app, "SetUserPoolMfaConfig", {
      UserPoolId: TEST_POOL_ID,
      MfaConfiguration: "OPTIONAL",
    }).expect(200);

    // 1. Authenticate to get access token
    const token = await authenticate(app);

    // 2. AssociateSoftwareToken returns a TOTP secret
    const assoc = await sdkRequest(app, "AssociateSoftwareToken", {
      AccessToken: token,
    }).expect(200);
    const secret = assoc.body.SecretCode as string;
    expect(secret).toBeTruthy();

    // 3. Verify with a real TOTP code
    const code = authenticator.generate(secret);
    const verify = await sdkRequest(app, "VerifySoftwareToken", {
      AccessToken: token,
      UserCode: code,
      FriendlyDeviceName: "my-test-device",
    }).expect(200);
    expect(verify.body.Status).toBe("SUCCESS");

    // 4. SetUserMFAPreference to mark it as preferred
    await sdkRequest(app, "SetUserMFAPreference", {
      AccessToken: token,
      SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true },
    }).expect(200);

    // 5. New sign-in returns SOFTWARE_TOKEN_MFA challenge (because pool is OPTIONAL + user has MFA enabled)
    const challenge = await sdkRequest(app, "InitiateAuth", {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: TEST_CLIENT_ID,
      AuthParameters: {
        USERNAME: "test-user-1",
        PASSWORD: "Password1!",
      },
    }).expect(200);
    expect(challenge.body.ChallengeName).toBe("SOFTWARE_TOKEN_MFA");
    expect(challenge.body.Session).toBeTruthy(); // #392

    // 6. Respond with a valid TOTP code
    const newCode = authenticator.generate(secret);
    const final = await sdkRequest(app, "RespondToAuthChallenge", {
      ClientId: TEST_CLIENT_ID,
      ChallengeName: "SOFTWARE_TOKEN_MFA",
      Session: challenge.body.Session,
      ChallengeResponses: {
        USERNAME: "test-user-1",
        SOFTWARE_TOKEN_MFA_CODE: newCode,
      },
    }).expect(200);
    expect(final.body.AuthenticationResult.AccessToken).toBeTruthy();
  });

  it("GetUserPoolMfaConfig + SetUserPoolMfaConfig", async () => {
    await sdkRequest(app, "SetUserPoolMfaConfig", {
      UserPoolId: TEST_POOL_ID,
      MfaConfiguration: "ON",
    }).expect(200);
    const get = await sdkRequest(app, "GetUserPoolMfaConfig", {
      UserPoolId: TEST_POOL_ID,
    }).expect(200);
    expect(get.body.MfaConfiguration).toBe("ON");
  });

  it("OPTIONAL pool + no user MFA: sign-in skips challenge", async () => {
    // Default pool has MfaConfiguration=OFF + user has no MFA → no challenge
    const res = await sdkRequest(app, "InitiateAuth", {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: TEST_CLIENT_ID,
      AuthParameters: {
        USERNAME: "test-user-1",
        PASSWORD: "Password1!",
      },
    }).expect(200);
    expect(res.body.AuthenticationResult).toBeTruthy();
    expect(res.body.ChallengeName).toBeUndefined();
  });
});
