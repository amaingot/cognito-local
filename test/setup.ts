import os from "os";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createApp, AppContext } from "../src/index";
import { loadOrGenerateKeys } from "../src/crypto";
import { UserPoolStore } from "../src/data/user-pool-store";
import { ClientStore } from "../src/data/client-store";
import { TokenStore } from "../src/data/token-store";
import { AppConfig } from "../src/types";
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
    userPoolId: TEST_POOL_ID,
    userPoolName: "test-pool",
    port: 0,
    issuerHost: TEST_ISSUER_HOST,
    dataDir,
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
  };

  const keys = loadOrGenerateKeys(dataDir);
  const userPoolStore = new UserPoolStore(dataDir);
  const clientStore = new ClientStore(dataDir);
  const tokenStore = new TokenStore();
  testTokenStores.push(tokenStore);

  // Initialize pool and clients from config
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
    userPoolId: TEST_POOL_ID,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const ctx: AppContext = { config, keys, userPoolStore, clientStore, tokenStore };
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
