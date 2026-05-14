import { Request, Response } from "express";
import { AppContext } from "../../index";
import { generateTokens } from "../../tokens/generate";
import {
  CodeMismatchError,
  InvalidParameterError,
  NotAuthorizedError,
  ResourceNotFoundError,
} from "../../errors";
import { validatePassword } from "../../util/password";

interface ChallengeResponses {
  USERNAME?: string;
  NEW_PASSWORD?: string;
  SMS_MFA_CODE?: string;
  SOFTWARE_TOKEN_MFA_CODE?: string;
  PASSWORD?: string;
  ANSWER?: string;
}

function issueTokens(
  ctx: AppContext,
  user: import("../../types").CognitoUser,
  clientId: string,
  poolId: string,
  client: import("../../types").AppClient
): {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
} {
  const issuer = `${ctx.config.issuerHost}/${poolId}`;
  const scope = client.allowedOAuthScopes.join(" ") || "openid";
  const tokens = generateTokens(
    user,
    clientId,
    ctx.keys,
    issuer,
    scope,
    client.accessTokenValidity
  );
  const refreshToken = ctx.tokenStore.createRefreshToken(
    user.username,
    clientId,
    poolId,
    client.refreshTokenValidity
  );
  ctx.userPoolStore.recordRefreshTokenForUser(
    poolId,
    user.username,
    refreshToken
  );
  return {
    accessToken: tokens.accessToken,
    idToken: tokens.idToken,
    refreshToken,
    expiresIn: tokens.expiresIn,
  };
}

export function respondToAuthChallengeHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const {
      ClientId,
      ChallengeName,
      ChallengeResponses,
      Session,
    } = req.body as {
      ClientId?: string;
      ChallengeName?: string;
      ChallengeResponses?: ChallengeResponses;
      Session?: string;
    };

    if (!ClientId || !ChallengeName || !ChallengeResponses) {
      throw new InvalidParameterError(
        "ClientId, ChallengeName, and ChallengeResponses are required."
      );
    }

    const client = ctx.clientStore.getClient(ClientId);
    if (!client) {
      throw new ResourceNotFoundError(`Client ${ClientId} not found.`);
    }
    const poolId = client.userPoolId;

    if (!Session) {
      throw new InvalidParameterError("Session is required.");
    }
    const session = ctx.tokenStore.consumeSession(Session);
    if (!session) {
      throw new NotAuthorizedError("Invalid session for the user.");
    }
    if (session.challengeName !== ChallengeName) {
      throw new InvalidParameterError(
        `Session is for ${session.challengeName}, not ${ChallengeName}.`
      );
    }

    const user = ctx.userPoolStore.getUser(poolId, session.username);
    if (!user) {
      throw new NotAuthorizedError();
    }
    const pool = ctx.userPoolStore.getPool(poolId);

    if (ChallengeName === "NEW_PASSWORD_REQUIRED") {
      const { NEW_PASSWORD } = ChallengeResponses;
      if (!NEW_PASSWORD) {
        throw new InvalidParameterError("NEW_PASSWORD is required.");
      }
      if (pool) validatePassword(NEW_PASSWORD, pool.passwordPolicy);

      ctx.userPoolStore.updateUser({
        ...user,
        password: NEW_PASSWORD,
        status: "CONFIRMED",
        updatedAt: ctx.clock.now().toISOString(),
      });
      const t = issueTokens(ctx, user, ClientId, poolId, client);
      res.json({
        AuthenticationResult: {
          AccessToken: t.accessToken,
          IdToken: t.idToken,
          RefreshToken: t.refreshToken,
          ExpiresIn: t.expiresIn,
          TokenType: "Bearer",
        },
      });
      return;
    }

    if (ChallengeName === "SMS_MFA") {
      const { SMS_MFA_CODE } = ChallengeResponses;
      if (!SMS_MFA_CODE) {
        throw new InvalidParameterError("SMS_MFA_CODE is required.");
      }
      if (user.mfaCode !== SMS_MFA_CODE) {
        throw new CodeMismatchError();
      }
      ctx.userPoolStore.updateUser({
        ...user,
        mfaCode: undefined,
        updatedAt: ctx.clock.now().toISOString(),
      });
      const t = issueTokens(ctx, user, ClientId, poolId, client);
      res.json({
        AuthenticationResult: {
          AccessToken: t.accessToken,
          IdToken: t.idToken,
          RefreshToken: t.refreshToken,
          ExpiresIn: t.expiresIn,
          TokenType: "Bearer",
        },
      });
      return;
    }

    if (ChallengeName === "SOFTWARE_TOKEN_MFA") {
      const { SOFTWARE_TOKEN_MFA_CODE } = ChallengeResponses;
      if (!SOFTWARE_TOKEN_MFA_CODE) {
        throw new InvalidParameterError(
          "SOFTWARE_TOKEN_MFA_CODE is required."
        );
      }
      if (!user.softwareTokenMfa?.secret) {
        throw new NotAuthorizedError("Software token MFA not configured.");
      }
      // Verify TOTP via otplib (deferred import for clean Phase 11 separation)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { authenticator } = require("otplib");
      const ok = authenticator.check(
        SOFTWARE_TOKEN_MFA_CODE,
        user.softwareTokenMfa.secret
      );
      if (!ok) throw new CodeMismatchError();

      const t = issueTokens(ctx, user, ClientId, poolId, client);
      res.json({
        AuthenticationResult: {
          AccessToken: t.accessToken,
          IdToken: t.idToken,
          RefreshToken: t.refreshToken,
          ExpiresIn: t.expiresIn,
          TokenType: "Bearer",
        },
      });
      return;
    }

    if (ChallengeName === "MFA_SETUP") {
      // Re-issue session for AssociateSoftwareToken flow
      const next = ctx.tokenStore.createSession(
        "MFA_SETUP",
        user.username,
        ClientId,
        poolId
      );
      res.json({
        ChallengeName: "MFA_SETUP",
        Session: next,
      });
      return;
    }

    if (ChallengeName === "SELECT_MFA_TYPE") {
      const { ANSWER } = ChallengeResponses;
      if (!ANSWER) {
        throw new InvalidParameterError("ANSWER is required.");
      }
      const challengeName =
        ANSWER === "SMS_MFA" ? "SMS_MFA" : "SOFTWARE_TOKEN_MFA";
      const next = ctx.tokenStore.createSession(
        challengeName,
        user.username,
        ClientId,
        poolId
      );
      res.json({
        ChallengeName: challengeName,
        Session: next,
        ChallengeParameters: { USER_ID_FOR_SRP: user.username },
      });
      return;
    }

    throw new InvalidParameterError(
      `Unsupported ChallengeName: ${ChallengeName}`
    );
  };
}

export function adminRespondToAuthChallengeHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const reqUserPoolId = req.body.UserPoolId;
    if (!reqUserPoolId) {
      throw new InvalidParameterError("UserPoolId is required.");
    }
    return respondToAuthChallengeHandler(ctx)(req, res);
  };
}
