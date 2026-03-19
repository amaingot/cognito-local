import express from "express";
import cors from "cors";
import { loadConfig, loadUsers } from "./config";
import { loadOrGenerateKeys, KeyPair } from "./crypto";
import { UserPoolStore } from "./data/user-pool-store";
import { ClientStore } from "./data/client-store";
import { TokenStore } from "./data/token-store";
import { createOidcRouter } from "./oidc/router";
import { createSdkRouter } from "./sdk/router";
import { AppConfig } from "./types";

export interface AppContext {
  config: AppConfig;
  keys: KeyPair;
  userPoolStore: UserPoolStore;
  clientStore: ClientStore;
  tokenStore: TokenStore;
}

export function createApp(ctx: AppContext): express.Express {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));

  // SDK API surface: POST / with X-Amz-Target header
  // Must be before OIDC router since both handle POST /
  app.use(createSdkRouter(ctx));

  // OIDC / Hosted UI surface
  app.use(createOidcRouter(ctx));

  return app;
}

function main(): void {
  const config = loadConfig();
  const users = loadUsers();
  const keys = loadOrGenerateKeys(config.dataDir);

  const userPoolStore = new UserPoolStore(config.dataDir);
  const clientStore = new ClientStore(config.dataDir);
  const tokenStore = new TokenStore(config.dataDir);

  // Initialize from config
  userPoolStore.initFromConfig(config, users);
  clientStore.initFromConfig(config);

  const ctx: AppContext = { config, keys, userPoolStore, clientStore, tokenStore };
  const app = createApp(ctx);

  app.listen(config.port, "0.0.0.0", () => {
    const issuer = `${config.issuerHost}/${config.userPoolId}`;
    console.log(`Cognito Local listening on http://0.0.0.0:${config.port}`);
    console.log(`Issuer: ${issuer}`);
    console.log(`User Pool: ${config.userPoolId}`);
    console.log(`Clients: ${config.clients.map((c) => c.clientId).join(", ") || "(none)"}`);
    console.log(`Users: ${users.map((u) => u.email).join(", ") || "(none)"}`);
  });
}

// Only run main when executed directly (not imported for testing)
if (require.main === module) {
  main();
}
