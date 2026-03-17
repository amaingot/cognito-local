import fs from "fs";
import { AppConfig, ClientConfig, UserConfig } from "./types";

const DEFAULT_CONFIG: AppConfig = {
  region: "us-east-1",
  userPoolId: "us-east-1_localDev01",
  userPoolName: "cognito-local",
  port: 9229,
  issuerHost: "",
  dataDir: "/temp-data",
  clients: [],
};

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

export function loadConfig(): AppConfig {
  const configPath = process.env.CONFIG_FILE || "/config/config.json";
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : undefined;
  const dataDir = process.env.DATA_DIR;

  let fileConfig: Partial<AppConfig> = {};
  if (fs.existsSync(configPath)) {
    fileConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    console.log(`Loaded config from ${configPath}`);
  } else {
    console.log(`No config file found at ${configPath}, using defaults`);
  }

  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    port: port ?? fileConfig.port ?? DEFAULT_CONFIG.port,
    dataDir: dataDir ?? fileConfig.dataDir ?? DEFAULT_CONFIG.dataDir,
    clients: (fileConfig.clients ?? []).map((c) => ({
      ...DEFAULT_CLIENT,
      ...c,
    })),
  };

  if (!config.issuerHost) {
    config.issuerHost = `http://localhost:${config.port}`;
  }

  return config;
}

export function loadUsers(): UserConfig[] {
  const usersPath = process.env.USERS_FILE || "/config/users.json";

  if (fs.existsSync(usersPath)) {
    const users = JSON.parse(fs.readFileSync(usersPath, "utf8"));
    console.log(`Loaded ${users.length} users from ${usersPath}`);
    return users;
  }

  console.log(`No users file found at ${usersPath}`);
  return [];
}
