import express from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import http from "http";
import https from "https";
import fs from "fs";
import { randomUUID } from "crypto";
import { loadConfig, loadUsers } from "./config";
import { loadOrGenerateKeys, KeyPair } from "./crypto";
import { UserPoolStore } from "./data/user-pool-store";
import { ClientStore } from "./data/client-store";
import { TokenStore } from "./data/token-store";
import { GroupStore } from "./data/group-store";
import { createOidcRouter } from "./oidc/router";
import { createSdkRouter } from "./sdk/router";
import { AppConfig } from "./types";
import { createLogger, Logger } from "./util/logger";
import { Clock, SystemClock } from "./services/clock";
import {
  AwsLambdaInvoker,
  HttpLambdaInvoker,
  TriggerInvoker,
} from "./services/lambda";
import { TriggerService } from "./triggers";

export interface AppContext {
  config: AppConfig;
  keys: KeyPair;
  logger: Logger;
  clock: Clock;
  userPoolStore: UserPoolStore;
  clientStore: ClientStore;
  tokenStore: TokenStore;
  groupStore: GroupStore;
  triggers: TriggerService;
}

export function createApp(ctx: AppContext): express.Express {
  const app = express();

  app.use(
    pinoHttp({
      logger: ctx.logger,
      genReqId: () => randomUUID().split("-")[0],
      quietReqLogger: true,
      autoLogging: {
        ignore: (req) => req.method === "OPTIONS" || req.url === "/health",
      },
    })
  );

  app.use(cors({ origin: true, credentials: true }));

  // Health endpoint (must be before routers)
  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  // SDK API surface: POST / with X-Amz-Target header
  // Must be before OIDC router since both handle POST /
  app.use(createSdkRouter(ctx));

  // OIDC / Hosted UI surface
  app.use(createOidcRouter(ctx));

  return app;
}

function main(): void {
  const logger = createLogger();
  const config = loadConfig(logger);
  const users = loadUsers(logger);
  const keys = loadOrGenerateKeys(config.dataDir);
  const clock = new SystemClock();

  const userPoolStore = new UserPoolStore(config.dataDir);
  const clientStore = new ClientStore(config.dataDir);
  const tokenStore = new TokenStore(config.dataDir);
  const groupStore = new GroupStore(config.dataDir);

  // Initialize from config
  userPoolStore.initFromConfig(config, users);
  clientStore.initFromConfig(config);

  const invoker = new TriggerInvoker(
    new HttpLambdaInvoker(logger),
    new AwsLambdaInvoker(logger, config.region)
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

  const useHttps = Boolean(config.https);
  const server = useHttps
    ? https.createServer(
        {
          key: fs.readFileSync(config.https!.key, "utf8"),
          cert: fs.readFileSync(config.https!.cert, "utf8"),
          ca: config.https!.ca
            ? fs.readFileSync(config.https!.ca, "utf8")
            : undefined,
        },
        app
      )
    : http.createServer(app);

  server.listen(config.port, "0.0.0.0", () => {
    const firstPool = config.pools[0];
    const proto = useHttps ? "https" : "http";
    const issuer = `${config.issuerHost}/${firstPool.id}`;
    logger.info(
      {
        port: config.port,
        proto,
        issuer,
        pools: config.pools.map((p) => p.id),
        clients: config.pools.flatMap((p) => p.clients.map((c) => c.clientId)),
        users: users.map((u) => u.email),
        devMode: config.devMode,
      },
      `Cognito Local listening on ${proto}://0.0.0.0:${config.port}`
    );
  });

  // Graceful shutdown — without this, `docker stop` / `docker restart` waits
  // the full 10-second grace period before SIGKILL because Node does not
  // terminate by itself when express has open keep-alive sockets.
  const shutdown = (signal: string): void => {
    logger.info({ signal }, "Shutting down");
    server.close((err) => {
      if (err) {
        logger.error({ err: err.message }, "Error during server close");
        process.exit(1);
      }
      process.exit(0);
    });
    // Backstop in case server.close hangs on an open socket
    setTimeout(() => {
      logger.warn("Force-exiting after shutdown timeout");
      process.exit(0);
    }, 5_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

// Only run main when executed directly (not imported for testing)
if (require.main === module) {
  main();
}
