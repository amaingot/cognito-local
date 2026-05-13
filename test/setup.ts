import os from "os";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createApp, AppContext } from "../src/index";
import { loadOrGenerateKeys } from "../src/crypto";
import { UserPoolStore } from "../src/data/user-pool-store";
import { ClientStore } from "../src/data/client-store";
import { TokenStore } from "../src/data/token-store";
import { GroupStore } from "../src/data/group-store";
import {
  AppConfig,
  DEFAULT_PASSWORD_POLICY,
  DEFAULT_SCHEMA_ATTRIBUTES,
} from "../src/types";
import { silentLogger } from "../src/util/logger";
import { SystemClock } from "../src/services/clock";
import {
  AwsLambdaInvoker,
  HttpLambdaInvoker,
  TriggerInvoker,
} from "../src/services/lambda";
import { TriggerService } from "../src/triggers";
import type express from "express";

const testDataDirs: string[] = [];
const testTokenStores: TokenStore[] = [];

export const TEST_POOL_ID = "us-east-1_testPool";
export const TEST_CLIENT_ID = "test-client";
export const TEST_CLIENT_SECRET = "test-secret";
export const TEST_ISSUER_HOST = "http://localhost:9229";

export function createTestApp(): { app: express.Express; ctx: AppContext } {
  const dataDir = path.join(
    os.tmpdir(),
    `cognito-local-test-${crypto.randomBytes(8).toString("hex")}`
  );
  fs.mkdirSync(dataDir, { recursive: true });
  testDataDirs.push(dataDir);

  const config: AppConfig = {
    region: "us-east-1",
    port: 0,
    issuerHost: TEST_ISSUER_HOST,
    dataDir,
    devMode: false,
    pools: [
      {
        id: TEST_POOL_ID,
        name: "test-pool",
        region: "us-east-1",
        usernameAttributes: ["email"],
        usernameCaseSensitive: false,
        autoVerifiedAttributes: ["email"],
        mfaConfiguration: "OFF",
        passwordPolicy: DEFAULT_PASSWORD_POLICY,
        schemaAttributes: DEFAULT_SCHEMA_ATTRIBUTES,
        clients: [
          {
            clientId: TEST_CLIENT_ID,
            clientSecret: TEST_CLIENT_SECRET,
            clientName: "Test",
            callbackUrls: ["http://localhost:3000/callback"],
            logoutUrls: ["http://localhost:3000"],
            explicitAuthFlows: [
              "ALLOW_USER_PASSWORD_AUTH",
              "ALLOW_REFRESH_TOKEN_AUTH",
            ],
            allowedOAuthFlows: ["code"],
            allowedOAuthScopes: ["openid", "email", "profile"],
            accessTokenValidity: 3600,
            idTokenValidity: 3600,
            refreshTokenValidity: 30 * 24 * 3600,
          },
        ],
      },
    ],
  };

  const keys = loadOrGenerateKeys(dataDir);
  const logger = silentLogger();
  const clock = new SystemClock();
  const userPoolStore = new UserPoolStore(dataDir);
  const clientStore = new ClientStore(dataDir);
  const tokenStore = new TokenStore(dataDir);
  const groupStore = new GroupStore(dataDir);
  testTokenStores.push(tokenStore);

  userPoolStore.initFromConfig(config, []);
  clientStore.initFromConfig(config);

  // Seed confirmed test user
  userPoolStore.createUser({
    username: "test-user-1",
    email: "test@example.com",
    password: "Password1!",
    attributes: {
      sub: "test-user-1",
      email: "test@example.com",
      email_verified: "true",
      given_name: "Test",
      family_name: "User",
    },
    groups: ["TestGroup"],
    status: "CONFIRMED",
    enabled: true,
    refreshTokens: [],
    userPoolId: TEST_POOL_ID,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Seed unconfirmed test user
  userPoolStore.createUser({
    username: "test-user-2",
    email: "unconfirmed@example.com",
    password: "Password1!",
    attributes: {
      sub: "test-user-2",
      email: "unconfirmed@example.com",
      email_verified: "false",
    },
    groups: [],
    status: "UNCONFIRMED",
    enabled: true,
    confirmationCode: "123456",
    refreshTokens: [],
    userPoolId: TEST_POOL_ID,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const invoker = new TriggerInvoker(
    new HttpLambdaInvoker(logger),
    new AwsLambdaInvoker(logger, "us-east-1")
  );
  const triggers = TriggerService.fromPools(invoker, logger, config.pools);

  const ctx: AppContext = {
    config,
    keys,
    logger,
    clock,
    userPoolStore,
    clientStore,
    tokenStore,
    groupStore,
    triggers,
  };
  const app = createApp(ctx);

  return { app, ctx };
}

afterEach(() => {
  while (testTokenStores.length > 0) {
    testTokenStores.pop()!.destroy();
  }
  while (testDataDirs.length > 0) {
    const dir = testDataDirs.pop()!;
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
});
