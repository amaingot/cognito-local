export interface UserPool {
  id: string;
  name: string;
  region: string;
  usernameAttributes: string[];
  schema: SchemaAttribute[];
  createdAt: string;
  updatedAt: string;
}

export interface SchemaAttribute {
  name: string;
  attributeDataType: "String" | "Number" | "DateTime" | "Boolean";
  required: boolean;
  mutable: boolean;
}

export interface AppClient {
  clientId: string;
  clientSecret?: string;
  clientName: string;
  userPoolId: string;
  callbackUrls: string[];
  logoutUrls: string[];
  explicitAuthFlows: string[];
  allowedOAuthFlows: string[];
  allowedOAuthScopes: string[];
  accessTokenValidity: number;
  idTokenValidity: number;
  refreshTokenValidity: number;
}

export interface CognitoUser {
  username: string;
  email: string;
  password: string;
  attributes: Record<string, string>;
  groups: string[];
  status: "UNCONFIRMED" | "CONFIRMED" | "FORCE_CHANGE_PASSWORD";
  enabled: boolean;
  confirmationCode?: string;
  userPoolId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthCode {
  code: string;
  userId: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  nonce?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  createdAt: number;
}

export interface RefreshTokenEntry {
  token: string;
  userId: string;
  clientId: string;
  userPoolId: string;
  createdAt: number;
  expiresAt: number;
}

export interface AppConfig {
  region: string;
  userPoolId: string;
  userPoolName: string;
  port: number;
  issuerHost: string;
  dataDir: string;
  clients: ClientConfig[];
}

export interface ClientConfig {
  clientId: string;
  clientSecret?: string;
  clientName: string;
  callbackUrls: string[];
  logoutUrls: string[];
  explicitAuthFlows: string[];
  allowedOAuthFlows: string[];
  allowedOAuthScopes: string[];
  accessTokenValidity?: number;
  idTokenValidity?: number;
  refreshTokenValidity?: number;
}

export interface UserConfig {
  username: string;
  email: string;
  password: string;
  status?: "UNCONFIRMED" | "CONFIRMED" | "FORCE_CHANGE_PASSWORD";
  attributes?: Record<string, string>;
  groups?: string[];
}
