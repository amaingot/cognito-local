import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";
import type express from "express";
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

describe("RespondToAuthChallenge", () => {
  let app: express.Express;

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it("NEW_PASSWORD_REQUIRED flow: AdminCreateUser -> AdminInitiateAuth -> RespondToAuthChallenge", async () => {
    // 1. AdminCreateUser puts user in FORCE_CHANGE_PASSWORD
    await sdkRequest(app, "AdminCreateUser", {
      UserPoolId: TEST_POOL_ID,
      Username: "forcechange@example.com",
      UserAttributes: [{ Name: "email", Value: "forcechange@example.com" }],
      TemporaryPassword: "TempPass1!",
    }).expect(200);

    // 2. Admin auth returns NEW_PASSWORD_REQUIRED challenge
    const challenge = await sdkRequest(app, "AdminInitiateAuth", {
      UserPoolId: TEST_POOL_ID,
      ClientId: TEST_CLIENT_ID,
      AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
      AuthParameters: {
        USERNAME: "forcechange@example.com",
        PASSWORD: "TempPass1!",
      },
    }).expect(200);
    expect(challenge.body.ChallengeName).toBe("NEW_PASSWORD_REQUIRED");
    expect(challenge.body.Session).toBeTruthy();

    // 3. RespondToAuthChallenge with NEW_PASSWORD
    const final = await sdkRequest(app, "AdminRespondToAuthChallenge", {
      UserPoolId: TEST_POOL_ID,
      ClientId: TEST_CLIENT_ID,
      ChallengeName: "NEW_PASSWORD_REQUIRED",
      Session: challenge.body.Session,
      ChallengeResponses: {
        USERNAME: "forcechange@example.com",
        NEW_PASSWORD: "FinalPass1!",
      },
    }).expect(200);
    expect(final.body.AuthenticationResult.AccessToken).toBeTruthy();
  });

  it("rejects an expired/invalid session", async () => {
    const res = await sdkRequest(app, "RespondToAuthChallenge", {
      ClientId: TEST_CLIENT_ID,
      ChallengeName: "NEW_PASSWORD_REQUIRED",
      Session: "fake-session",
      ChallengeResponses: {
        USERNAME: "x",
        NEW_PASSWORD: "NewPass1!",
      },
    }).expect(400);
    expect(res.body.__type).toBe("NotAuthorizedException");
  });
});
