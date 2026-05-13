import { Request, Response } from "express";
import { AppContext } from "../../index";
import { generateTokens, TokenOverrides } from "../../tokens/generate";
import {
  InvalidParameterError,
  NotAuthorizedError,
  ResourceNotFoundError,
  UserNotConfirmedError,
} from "../../errors";
import { CognitoUser, UserPool } from "../../types";
import { triggerEvent } from "../../triggers";

async function maybeApplyPreTokenGeneration(
  ctx: AppContext,
  pool: UserPool,
  user: CognitoUser,
  clientId: string,
  source: string,
  clientMetadata?: Record<string, string>
): Promise<TokenOverrides | undefined> {
  // V2 takes precedence (modifies access token + id token, #460)
  const useV2 = ctx.triggers.enabled(pool.id, "preTokenGenerationV2");
  const useV1 = ctx.triggers.enabled(pool.id, "preTokenGeneration");
  if (!useV1 && !useV2) return undefined;

  const triggerName = useV2 ? "preTokenGenerationV2" : "preTokenGeneration";
  const event = triggerEvent({
    triggerSource: `TokenGeneration_${source}`,
    userPoolId: pool.id,
    username: user.username,
    region: pool.region,
    clientId,
    userAttributes: user.attributes,
    request: {
      groupConfiguration: {
        groupsToOverride: user.groups,
        iamRolesToOverride: undefined,
        preferredRole: undefined,
      },
      clientMetadata,
    },
  });
  const result = (await ctx.triggers.fire(pool, triggerName, event)) as
    | {
        response?: {
          claimsOverrideDetails?: import("../../tokens/generate").TriggerClaimsOverride;
          accessTokenClaimsOverrideDetails?: import("../../tokens/generate").TriggerClaimsOverride;
          idTokenClaimsOverrideDetails?: import("../../tokens/generate").TriggerClaimsOverride;
        };
      }
    | null;
  const r = result?.response ?? {};
  if (useV2) {
    return {
      idToken: r.idTokenClaimsOverrideDetails ?? r.claimsOverrideDetails,
      accessToken: r.accessTokenClaimsOverrideDetails,
    };
  }
  return { idToken: r.claimsOverrideDetails };
}

export function initiateAuthHandler(ctx: AppContext) {
  return async (req: Request, res: Response): Promise<void> => {
    const { AuthFlow, ClientId, AuthParameters, ClientMetadata } = req.body;

    if (!AuthFlow || !ClientId || !AuthParameters) {
      throw new InvalidParameterError(
        "AuthFlow, ClientId, and AuthParameters are required."
      );
    }

    const client = ctx.clientStore.getClient(ClientId);
    if (!client) {
      throw new ResourceNotFoundError(`Client ${ClientId} not found.`);
    }

    const poolId = client.userPoolId;
    const pool = ctx.userPoolStore.getPool(poolId);
    if (!pool) {
      throw new ResourceNotFoundError(`User pool ${poolId} does not exist.`);
    }
    const issuer = `${ctx.config.issuerHost}/${poolId}`;

    if (AuthFlow === "USER_SRP_AUTH") {
      throw new InvalidParameterError(
        "USER_SRP_AUTH is not supported by cognito-local. Use USER_PASSWORD_AUTH instead."
      );
    }

    if (AuthFlow === "USER_PASSWORD_AUTH") {
      const { USERNAME, PASSWORD } = AuthParameters;
      if (!USERNAME || !PASSWORD) {
        throw new InvalidParameterError("USERNAME and PASSWORD are required.");
      }

      let user = ctx.userPoolStore.getUserByUsername(poolId, USERNAME);

      // UserMigration trigger — invoked when user doesn't exist (#299 mitigation)
      if (!user && ctx.triggers.enabled(poolId, "userMigration")) {
        const event = triggerEvent({
          triggerSource: "UserMigration_Authentication",
          userPoolId: poolId,
          username: USERNAME,
          region: pool.region,
          clientId: ClientId,
          userAttributes: {},
          request: {
            password: PASSWORD,
            validationData: ClientMetadata,
            clientMetadata: undefined,
          },
        });
        const result = (await ctx.triggers.fire(pool, "userMigration", event)) as
          | {
              response?: {
                userAttributes?: Record<string, string>;
                finalUserStatus?: "CONFIRMED" | "RESET_REQUIRED";
                messageAction?: string;
                desiredDeliveryMediums?: string[];
              };
            }
          | null;
        const r = result?.response;
        if (r?.userAttributes) {
          // Auto-fill sub if the migration trigger didn't supply one (#299)
          if (!r.userAttributes.sub) {
            r.userAttributes.sub = ctx.userPoolStore.generateUsername();
          }
          const sub = r.userAttributes.sub;
          const internalUsername = pool.usernameAttributes.includes("email")
            ? sub
            : USERNAME;
          const now = ctx.clock.now().toISOString();
          const migrated: CognitoUser = {
            username: internalUsername,
            email: (r.userAttributes.email ?? USERNAME).toLowerCase(),
            password: PASSWORD,
            attributes: {
              ...r.userAttributes,
              email: (r.userAttributes.email ?? USERNAME).toLowerCase(),
            },
            groups: [],
            status: r.finalUserStatus ?? "CONFIRMED",
            enabled: true,
            refreshTokens: [],
            userPoolId: poolId,
            createdAt: now,
            updatedAt: now,
          };
          ctx.userPoolStore.createUser(migrated);
          user = migrated;
        }
      }

      if (!user) throw new NotAuthorizedError();
      if (!user.enabled) throw new NotAuthorizedError("User is disabled.");
      if (user.status === "UNCONFIRMED") throw new UserNotConfirmedError();
      if (user.password !== PASSWORD) throw new NotAuthorizedError();

      // MFA challenge dispatch — pool.mfaConfiguration drives this
      const userMfaMethods = user.userMfaSettingList ?? [];
      const poolMfaOn = pool.mfaConfiguration === "ON";
      const poolMfaOptional =
        pool.mfaConfiguration === "OPTIONAL" && userMfaMethods.length > 0;
      if (poolMfaOn || poolMfaOptional) {
        if (userMfaMethods.length > 1) {
          const session = ctx.tokenStore.createSession(
            "SELECT_MFA_TYPE",
            user.username,
            ClientId,
            poolId
          );
          res.json({
            ChallengeName: "SELECT_MFA_TYPE",
            Session: session,
            ChallengeParameters: {
              USER_ID_FOR_SRP: user.username,
              MFAS_CAN_CHOOSE: JSON.stringify(userMfaMethods),
            },
          });
          return;
        }
        const only = userMfaMethods[0];
        if (only === "SOFTWARE_TOKEN_MFA") {
          const session = ctx.tokenStore.createSession(
            "SOFTWARE_TOKEN_MFA",
            user.username,
            ClientId,
            poolId
          );
          res.json({
            ChallengeName: "SOFTWARE_TOKEN_MFA",
            Session: session,
            ChallengeParameters: { USER_ID_FOR_SRP: user.username },
          });
          return;
        }
        if (only === "SMS_MFA") {
          const code = ctx.userPoolStore.generateConfirmationCode();
          ctx.userPoolStore.updateUser({
            ...user,
            mfaCode: code,
            updatedAt: ctx.clock.now().toISOString(),
          });
          ctx.logger.info(
            { username: user.username, code },
            "SMS_MFA: code issued"
          );
          const session = ctx.tokenStore.createSession(
            "SMS_MFA",
            user.username,
            ClientId,
            poolId
          );
          res.json({
            ChallengeName: "SMS_MFA",
            Session: session,
            ChallengeParameters: {
              USER_ID_FOR_SRP: user.username,
              CODE_DELIVERY_DELIVERY_MEDIUM: "SMS",
              CODE_DELIVERY_DESTINATION: user.attributes.phone_number ?? "",
            },
          });
          return;
        }
      }

      // PreAuthentication trigger
      if (ctx.triggers.enabled(poolId, "preAuthentication")) {
        await ctx.triggers.fire(
          pool,
          "preAuthentication",
          triggerEvent({
            triggerSource: "PreAuthentication_Authentication",
            userPoolId: poolId,
            username: user.username,
            region: pool.region,
            clientId: ClientId,
            userAttributes: user.attributes,
            request: { validationData: ClientMetadata },
          })
        );
      }

      const scope = client.allowedOAuthScopes.join(" ") || "openid";
      const overrides = await maybeApplyPreTokenGeneration(
        ctx,
        pool,
        user,
        ClientId,
        "Authentication"
      );
      const tokens = generateTokens(
        user,
        ClientId,
        ctx.keys,
        issuer,
        scope,
        client.accessTokenValidity,
        undefined,
        overrides
      );
      const refreshToken = ctx.tokenStore.createRefreshToken(
        user.username,
        ClientId,
        poolId,
        client.refreshTokenValidity
      );
      ctx.userPoolStore.recordRefreshTokenForUser(
        poolId,
        user.username,
        refreshToken
      );

      // PostAuthentication trigger
      if (ctx.triggers.enabled(poolId, "postAuthentication")) {
        await ctx.triggers
          .fire(
            pool,
            "postAuthentication",
            triggerEvent({
              triggerSource: "PostAuthentication_Authentication",
              userPoolId: poolId,
              username: user.username,
              region: pool.region,
              clientId: ClientId,
              userAttributes: user.attributes,
            })
          )
          .catch((err) => ctx.logger.warn({ err }, "PostAuthentication failed"));
      }

      res.json({
        AuthenticationResult: {
          AccessToken: tokens.accessToken,
          IdToken: tokens.idToken,
          RefreshToken: refreshToken,
          ExpiresIn: tokens.expiresIn,
          TokenType: "Bearer",
        },
      });
      return;
    }

    if (AuthFlow === "REFRESH_TOKEN_AUTH" || AuthFlow === "REFRESH_TOKEN") {
      const { REFRESH_TOKEN } = AuthParameters;
      if (!REFRESH_TOKEN) {
        throw new InvalidParameterError("REFRESH_TOKEN is required.");
      }
      const tokenEntry = ctx.tokenStore.getRefreshToken(REFRESH_TOKEN);
      if (!tokenEntry || tokenEntry.clientId !== ClientId) {
        throw new NotAuthorizedError("Invalid refresh token.");
      }
      const user = ctx.userPoolStore.getUser(
        tokenEntry.userPoolId,
        tokenEntry.userId
      );
      if (!user) {
        throw new NotAuthorizedError("User no longer exists.");
      }
      if (!user.enabled) {
        throw new NotAuthorizedError("User is disabled.");
      }

      const scope = client.allowedOAuthScopes.join(" ") || "openid";
      const overrides = await maybeApplyPreTokenGeneration(
        ctx,
        pool,
        user,
        ClientId,
        "RefreshTokens"
      );
      const tokens = generateTokens(
        user,
        ClientId,
        ctx.keys,
        issuer,
        scope,
        client.accessTokenValidity,
        undefined,
        overrides
      );
      res.json({
        AuthenticationResult: {
          AccessToken: tokens.accessToken,
          IdToken: tokens.idToken,
          ExpiresIn: tokens.expiresIn,
          TokenType: "Bearer",
        },
      });
      return;
    }

    throw new InvalidParameterError(`Unsupported AuthFlow: ${AuthFlow}`);
  };
}
