import request from "supertest";
import http from "http";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

// Tiny HTTP server that responds with a given Lambda response shape.
function startTriggerServer(
  responder: (event: Record<string, unknown>) => Record<string, unknown>
): Promise<{ url: string; server: http.Server; received: Record<string, unknown>[] }> {
  return new Promise((resolve) => {
    const received: Record<string, unknown>[] = [];
    const server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        received.push(body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(responder(body)));
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        server,
        received,
      });
    });
  });
}

describe("Lambda triggers", () => {
  let app: express.Express;
  let ctx: AppContext;
  let trigServer: { server: http.Server } | undefined;

  beforeEach(() => {
    ({ app, ctx } = createTestApp());
  });

  afterEach(() => {
    if (trigServer) trigServer.server.close();
    trigServer = undefined;
  });

  it("fires PreSignUp and passes ValidationData (#351)", async () => {
    const trig = await startTriggerServer((event) => ({
      ...event,
      response: {
        autoConfirmUser: true,
        autoVerifyEmail: true,
      },
    }));
    trigServer = trig;
    ctx.triggers.setPoolTriggers(TEST_POOL_ID, {
      preSignUp: { type: "http", endpoint: trig.url },
    });

    await sdkRequest(app, "SignUp", {
      ClientId: TEST_CLIENT_ID,
      Username: "trig@example.com",
      Password: "Password1!",
      UserAttributes: [{ Name: "email", Value: "trig@example.com" }],
      ValidationData: [{ Name: "isBusiness", Value: "true" }],
    }).expect(200);

    expect(trig.received).toHaveLength(1);
    const evt = trig.received[0] as { triggerSource: string; request: Record<string, unknown> };
    expect(evt.triggerSource).toBe("PreSignUp_SignUp");
    const reqBody = evt.request as { validationData: Record<string, string> };
    expect(reqBody.validationData).toEqual({ isBusiness: "true" }); // #351

    // user should be auto-confirmed
    const user = ctx.userPoolStore.getUserByEmail(
      TEST_POOL_ID,
      "trig@example.com"
    )!;
    expect(user.status).toBe("CONFIRMED");
    expect(user.attributes.email_verified).toBe("true");
  });

  it("fires PreTokenGeneration and applies claim overrides", async () => {
    const trig = await startTriggerServer(() => ({
      response: {
        claimsOverrideDetails: {
          claimsToAddOrOverride: { custom_claim: "trigger-added" },
          claimsToSuppress: ["email_verified"],
        },
      },
    }));
    trigServer = trig;
    ctx.triggers.setPoolTriggers(TEST_POOL_ID, {
      preTokenGeneration: { type: "http", endpoint: trig.url },
    });

    const auth = await sdkRequest(app, "InitiateAuth", {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: TEST_CLIENT_ID,
      AuthParameters: {
        USERNAME: "test-user-1",
        PASSWORD: "Password1!",
      },
    }).expect(200);

    const idToken = auth.body.AuthenticationResult.IdToken as string;
    const payload = JSON.parse(
      Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")
    );
    expect(payload.custom_claim).toBe("trigger-added");
    expect(payload.email_verified).toBeUndefined();
  });

  it("fires PreTokenGeneration V2 and overrides access token (#460)", async () => {
    const trig = await startTriggerServer(() => ({
      response: {
        accessTokenClaimsOverrideDetails: {
          claimsToAddOrOverride: { custom_scope: "v2-only" },
        },
        idTokenClaimsOverrideDetails: {
          claimsToAddOrOverride: { id_claim: "v2-id" },
        },
      },
    }));
    trigServer = trig;
    ctx.triggers.setPoolTriggers(TEST_POOL_ID, {
      preTokenGenerationV2: { type: "http", endpoint: trig.url },
    });

    const auth = await sdkRequest(app, "InitiateAuth", {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: TEST_CLIENT_ID,
      AuthParameters: {
        USERNAME: "test-user-1",
        PASSWORD: "Password1!",
      },
    }).expect(200);

    const access = JSON.parse(
      Buffer.from(
        (auth.body.AuthenticationResult.AccessToken as string).split(".")[1],
        "base64url"
      ).toString("utf8")
    );
    expect(access.custom_scope).toBe("v2-only");

    const id = JSON.parse(
      Buffer.from(
        (auth.body.AuthenticationResult.IdToken as string).split(".")[1],
        "base64url"
      ).toString("utf8")
    );
    expect(id.id_claim).toBe("v2-id");
  });

  it("auto-fills sub when UserMigration trigger doesn't supply one (#299)", async () => {
    const trig = await startTriggerServer(() => ({
      response: {
        userAttributes: {
          email: "migrated@example.com",
          email_verified: "true",
          // intentionally no sub
        },
        finalUserStatus: "CONFIRMED",
      },
    }));
    trigServer = trig;
    ctx.triggers.setPoolTriggers(TEST_POOL_ID, {
      userMigration: { type: "http", endpoint: trig.url },
    });

    const auth = await sdkRequest(app, "InitiateAuth", {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: TEST_CLIENT_ID,
      AuthParameters: {
        USERNAME: "migrated@example.com",
        PASSWORD: "Password1!",
      },
    }).expect(200);

    expect(auth.body.AuthenticationResult.AccessToken).toBeTruthy();
    const user = ctx.userPoolStore.getUserByEmail(
      TEST_POOL_ID,
      "migrated@example.com"
    )!;
    expect(user.attributes.sub).toBeTruthy(); // auto-filled
  });

  it("pool-scoped triggers — different pools can have different triggers (#464)", async () => {
    const trigA = await startTriggerServer(() => ({
      response: { autoConfirmUser: false },
    }));
    trigServer = trigA;
    ctx.triggers.setPoolTriggers(TEST_POOL_ID, {
      preSignUp: { type: "http", endpoint: trigA.url },
    });
    // Different pool would have different (or no) triggers
    expect(ctx.triggers.enabled(TEST_POOL_ID, "preSignUp")).toBe(true);
    expect(ctx.triggers.enabled("some-other-pool", "preSignUp")).toBe(false);
  });
});
