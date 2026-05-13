// ============================================================================
// Configuration types — v1.0 multi-pool schema
// ============================================================================

export interface AppConfig {
  region: string;
  port: number;
  issuerHost: string;
  dataDir: string;
  pools: PoolConfig[];
  devMode: boolean;
  https?: HttpsConfig;
}

export interface HttpsConfig {
  key: string; // path to PEM
  cert: string; // path to PEM
  ca?: string;
}

export interface PoolConfig {
  id: string;
  name: string;
  region?: string;
  usernameAttributes: string[];
  usernameCaseSensitive: boolean;
  autoVerifiedAttributes: string[];
  mfaConfiguration: "OFF" | "ON" | "OPTIONAL";
  passwordPolicy: PasswordPolicy;
  schemaAttributes: SchemaAttribute[];
  clients: ClientConfig[];
  triggers?: PoolTriggerConfig;
}

export interface PasswordPolicy {
  minimumLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSymbols: boolean;
  temporaryPasswordValidityDays: number;
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
  tokenValidityUnits?: TokenValidityUnits;
  generateSecret?: boolean;
  preventUserExistenceErrors?: "ENABLED" | "LEGACY";
}

export interface TokenValidityUnits {
  accessToken?: "seconds" | "minutes" | "hours" | "days";
  idToken?: "seconds" | "minutes" | "hours" | "days";
  refreshToken?: "seconds" | "minutes" | "hours" | "days";
}

export interface UserConfig {
  username: string;
  email: string;
  password: string;
  status?: UserStatus;
  attributes?: Record<string, string>;
  groups?: string[];
  poolId?: string; // defaults to first pool if not specified
}

export type TriggerDef =
  | { type: "http"; endpoint: string }
  | { type: "lambda"; arn: string };

export interface PoolTriggerConfig {
  preSignUp?: TriggerDef;
  postConfirmation?: TriggerDef;
  preAuthentication?: TriggerDef;
  postAuthentication?: TriggerDef;
  preTokenGeneration?: TriggerDef;
  preTokenGenerationV2?: TriggerDef;
  userMigration?: TriggerDef;
  customMessage?: TriggerDef;
  customEmailSender?: TriggerDef;
  customSMSSender?: TriggerDef;
}

// ============================================================================
// Domain types — persisted entities
// ============================================================================

export type UserStatus =
  | "UNCONFIRMED"
  | "CONFIRMED"
  | "FORCE_CHANGE_PASSWORD"
  | "RESET_REQUIRED"
  | "COMPROMISED"
  | "ARCHIVED"
  | "UNKNOWN";

export interface UserPool {
  id: string;
  name: string;
  region: string;
  usernameAttributes: string[];
  usernameCaseSensitive: boolean;
  autoVerifiedAttributes: string[];
  mfaConfiguration: "OFF" | "ON" | "OPTIONAL";
  passwordPolicy: PasswordPolicy;
  schema: SchemaAttribute[];
  smsConfiguration?: {
    snsCallerArn?: string;
    externalId?: string;
  };
  emailConfiguration?: {
    sourceArn?: string;
    replyToEmailAddress?: string;
    emailSendingAccount?: "COGNITO_DEFAULT" | "DEVELOPER";
  };
  smsAuthenticationMessage?: string;
  smsVerificationMessage?: string;
  emailVerificationMessage?: string;
  emailVerificationSubject?: string;
  verificationMessageTemplate?: VerificationMessageTemplate;
  deviceConfiguration?: DeviceConfiguration;
  policies?: { passwordPolicy: PasswordPolicy };
  estimatedNumberOfUsers?: number;
  arn?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationMessageTemplate {
  emailMessage?: string;
  emailMessageByLink?: string;
  emailSubject?: string;
  emailSubjectByLink?: string;
  smsMessage?: string;
  defaultEmailOption?: "CONFIRM_WITH_LINK" | "CONFIRM_WITH_CODE";
}

export interface DeviceConfiguration {
  challengeRequiredOnNewDevice?: boolean;
  deviceOnlyRememberedOnUserPrompt?: boolean;
}

export interface SchemaAttribute {
  name: string;
  attributeDataType: "String" | "Number" | "DateTime" | "Boolean";
  required: boolean;
  mutable: boolean;
  developerOnlyAttribute: boolean;
  stringAttributeConstraints?: {
    minLength?: string;
    maxLength?: string;
  };
  numberAttributeConstraints?: {
    minValue?: string;
    maxValue?: string;
  };
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
  tokenValidityUnits?: TokenValidityUnits;
  preventUserExistenceErrors?: "ENABLED" | "LEGACY";
  supportedIdentityProviders?: string[];
  readAttributes?: string[];
  writeAttributes?: string[];
  generateSecret?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MfaOption {
  deliveryMedium: "SMS" | "EMAIL";
  attributeName: string;
}

export interface SoftwareTokenMfaConfiguration {
  enabled: boolean;
  secret?: string;
  friendlyDeviceName?: string;
}

export interface CognitoUser {
  username: string;
  email: string;
  password: string;
  attributes: Record<string, string>;
  groups: string[];
  status: UserStatus;
  enabled: boolean;
  confirmationCode?: string;
  attributeVerificationCode?: string;
  mfaCode?: string;
  mfaOptions?: MfaOption[];
  userMfaSettingList?: string[];
  preferredMfaSetting?: string;
  softwareTokenMfa?: SoftwareTokenMfaConfiguration;
  refreshTokens: string[]; // tokens issued to this user (for revocation, fixes #381)
  userPoolId: string;
  createdAt: string; // ISO; converted to Date at response boundary
  updatedAt: string;
}

export interface Group {
  groupName: string;
  description?: string;
  precedence?: number;
  roleArn?: string;
  userPoolId: string;
  members: string[]; // internal usernames
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
  revoked?: boolean;
}

export interface SessionEntry {
  session: string;
  challengeName: string;
  username: string;
  clientId: string;
  userPoolId: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  expiresAt: number;
}

// ============================================================================
// Niche entities (Phase 13)
// ============================================================================

export interface IdentityProvider {
  providerName: string;
  providerType:
    | "SAML"
    | "Facebook"
    | "Google"
    | "LoginWithAmazon"
    | "SignInWithApple"
    | "OIDC";
  userPoolId: string;
  providerDetails: Record<string, string>;
  attributeMapping?: Record<string, string>;
  idpIdentifiers?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ResourceServer {
  identifier: string;
  name: string;
  userPoolId: string;
  scopes: { scopeName: string; scopeDescription: string }[];
}

export interface UserImportJob {
  jobId: string;
  jobName: string;
  userPoolId: string;
  preSignedUrl: string;
  cloudWatchLogsRoleArn?: string;
  status:
    | "Created"
    | "Pending"
    | "InProgress"
    | "Expired"
    | "Stopping"
    | "Stopped"
    | "Succeeded"
    | "Failed";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  importedUsers?: number;
  skippedUsers?: number;
  failedUsers?: number;
}

export interface Device {
  deviceKey: string;
  username: string;
  userPoolId: string;
  deviceAttributes: Record<string, string>;
  deviceCreateDate: string;
  deviceLastModifiedDate: string;
  deviceLastAuthenticatedDate?: string;
  deviceRememberedStatus: "remembered" | "not_remembered";
}

export interface RiskConfiguration {
  userPoolId: string;
  clientId?: string;
  compromisedCredentialsRiskConfiguration?: Record<string, unknown>;
  accountTakeoverRiskConfiguration?: Record<string, unknown>;
  riskExceptionConfiguration?: Record<string, unknown>;
}

export interface UserPoolDomain {
  domain: string;
  userPoolId: string;
  customDomainConfig?: { certificateArn: string };
  awsAccountId?: string;
  cloudFrontDistribution?: string;
  s3Bucket?: string;
  version?: string;
  status?: "CREATING" | "DELETING" | "UPDATING" | "ACTIVE" | "FAILED";
}

export interface UICustomization {
  userPoolId: string;
  clientId: string; // "ALL" for default
  css?: string;
  cssVersion?: string;
  imageUrl?: string;
  createdAt: string;
  lastModifiedAt: string;
}

export interface ResourceTag {
  resourceArn: string;
  tags: Record<string, string>;
}

export interface AuthEvent {
  eventId: string;
  userPoolId: string;
  username: string;
  eventType: string;
  eventResponse: "Pass" | "Fail";
  eventRisk?: { riskDecision: string; riskLevel: string };
  challengeResponses?: { challengeName: string; challengeResponse: string }[];
  eventContextData?: Record<string, unknown>;
  eventFeedback?: { feedbackValue: string; provider: string; feedbackDate: string };
  creationDate: string;
}

// ============================================================================
// Helper: default password policy
// ============================================================================

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minimumLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSymbols: false,
  temporaryPasswordValidityDays: 7,
};

export const DEFAULT_SCHEMA_ATTRIBUTES: SchemaAttribute[] = [
  {
    name: "email",
    attributeDataType: "String",
    required: true,
    mutable: true,
    developerOnlyAttribute: false,
  },
  {
    name: "given_name",
    attributeDataType: "String",
    required: false,
    mutable: true,
    developerOnlyAttribute: false,
  },
  {
    name: "family_name",
    attributeDataType: "String",
    required: false,
    mutable: true,
    developerOnlyAttribute: false,
  },
  {
    name: "nickname",
    attributeDataType: "String",
    required: false,
    mutable: true,
    developerOnlyAttribute: false,
  },
  {
    name: "phone_number",
    attributeDataType: "String",
    required: false,
    mutable: true,
    developerOnlyAttribute: false,
  },
];
