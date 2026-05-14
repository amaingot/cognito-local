import fs from "fs";
import { Logger } from "./util/logger";
import {
  AppConfig,
  ClientConfig,
  DEFAULT_PASSWORD_POLICY,
  DEFAULT_SCHEMA_ATTRIBUTES,
  PoolConfig,
  UserConfig,
} from "./types";

const MIGRATION_GUIDE_URL =
  "https://amaingot.github.io/cognito-local/migration/v1";

const DEFAULT_CLIENT: Omit<ClientConfig, "clientId" | "clientName"> = {
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
};

function detectLegacyShape(raw: Record<string, unknown>): boolean {
  // Old 0.x shape had `userPoolId` and a top-level `clients` array
  return (
    typeof raw.userPoolId === "string" ||
    typeof raw.userPoolName === "string" ||
    (Array.isArray(raw.clients) && !Array.isArray(raw.pools))
  );
}

export class ConfigMigrationError extends Error {
  constructor() {
    super(
      [
        "cognito-local 1.0 uses a multi-pool config schema.",
        "Your config.json uses the old 0.x single-pool shape.",
        `Migration guide: ${MIGRATION_GUIDE_URL}`,
      ].join("\n")
    );
    this.name = "ConfigMigrationError";
  }
}

function buildDefaultConfig(): AppConfig {
  return {
    region: "us-east-1",
    port: 9229,
    issuerHost: "",
    dataDir: "/temp-data",
    devMode: false,
    pools: [
      {
        id: "us-east-1_localDev01",
        name: "cognito-local",
        region: "us-east-1",
        usernameAttributes: ["email"],
        usernameCaseSensitive: false,
        autoVerifiedAttributes: ["email"],
        mfaConfiguration: "OFF",
        passwordPolicy: DEFAULT_PASSWORD_POLICY,
        schemaAttributes: DEFAULT_SCHEMA_ATTRIBUTES,
        clients: [],
      },
    ],
  };
}

function normalizePool(p: Partial<PoolConfig>): PoolConfig {
  return {
    id: p.id ?? "us-east-1_localDev01",
    name: p.name ?? "cognito-local",
    region: p.region,
    usernameAttributes: p.usernameAttributes ?? ["email"],
    usernameCaseSensitive: p.usernameCaseSensitive ?? false,
    autoVerifiedAttributes: p.autoVerifiedAttributes ?? ["email"],
    mfaConfiguration: p.mfaConfiguration ?? "OFF",
    passwordPolicy: { ...DEFAULT_PASSWORD_POLICY, ...(p.passwordPolicy ?? {}) },
    schemaAttributes: p.schemaAttributes ?? DEFAULT_SCHEMA_ATTRIBUTES,
    clients: (p.clients ?? []).map((c) => ({
      ...DEFAULT_CLIENT,
      ...c,
    })),
    triggers: p.triggers,
  };
}

export function loadConfig(logger?: Logger): AppConfig {
  const configPath = process.env.CONFIG_FILE || "/config/config.json";
  const portEnv = process.env.PORT ? parseInt(process.env.PORT, 10) : undefined;
  const dataDirEnv = process.env.DATA_DIR;
  const devMode =
    process.env.COGNITO_LOCAL_DEVMODE === "1" ||
    process.env.COGNITO_LOCAL_DEVMODE === "true";
  const issuerHostEnv = process.env.ISSUER_HOST;

  let fileConfig: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    fileConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    logger?.info({ configPath }, "Loaded config");
  } else {
    logger?.info({ configPath }, "No config file found, using defaults");
  }

  if (detectLegacyShape(fileConfig)) {
    throw new ConfigMigrationError();
  }

  const defaults = buildDefaultConfig();
  const fileC = fileConfig as Partial<AppConfig>;

  const pools = (fileC.pools && fileC.pools.length > 0
    ? fileC.pools
    : defaults.pools
  ).map(normalizePool);

  const config: AppConfig = {
    region: fileC.region ?? defaults.region,
    port: portEnv ?? fileC.port ?? defaults.port,
    issuerHost: issuerHostEnv ?? fileC.issuerHost ?? defaults.issuerHost,
    dataDir: dataDirEnv ?? fileC.dataDir ?? defaults.dataDir,
    devMode: devMode || fileC.devMode || defaults.devMode,
    pools,
    https: fileC.https,
  };

  if (!config.issuerHost) {
    config.issuerHost = `http://localhost:${config.port}`;
  }

  return config;
}

export function loadUsers(logger?: Logger): UserConfig[] {
  const usersPath = process.env.USERS_FILE || "/config/users.json";

  if (fs.existsSync(usersPath)) {
    const users = JSON.parse(fs.readFileSync(usersPath, "utf8"));
    logger?.info({ usersPath, count: users.length }, "Loaded users");
    return users;
  }

  logger?.info({ usersPath }, "No users file found");
  return [];
}

/**
 * Helper: get the "default" pool — used by single-pool flows in the OIDC surface
 * and by handlers that need a fallback when no UserPoolId is provided.
 */
export function defaultPool(config: AppConfig): PoolConfig {
  if (config.pools.length === 0) {
    throw new Error("No user pools configured");
  }
  return config.pools[0];
}
