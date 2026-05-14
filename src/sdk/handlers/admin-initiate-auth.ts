import { Request, Response } from "express";
import { AppContext } from "../../index";
import { generateTokens } from "../../tokens/generate";
import {
  InvalidParameterError,
  NotAuthorizedError,
  ResourceNotFoundError,
  UserNotConfirmedError,
} from "../../errors";

export function adminInitiateAuthHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, ClientId, AuthFlow, AuthParameters } = req.body;

    if (!UserPoolId || !ClientId || !AuthFlow || !AuthParameters) {
      throw new InvalidParameterError(
        "UserPoolId, ClientId, AuthFlow, and AuthParameters are required."
      );
    }

    const pool = ctx.userPoolStore.getPool(UserPoolId);
    if (!pool) {
      throw new ResourceNotFoundError(
        `User pool ${UserPoolId} does not exist.`
      );
    }

    const client = ctx.clientStore.getClient(ClientId);
    if (!client || client.userPoolId !== UserPoolId) {
      throw new ResourceNotFoundError(`Client ${ClientId} not found.`);
    }

    const issuer = `${ctx.config.issuerHost}/${UserPoolId}`;

    if (
      AuthFlow === "ADMIN_NO_SRP_AUTH" ||
      AuthFlow === "ADMIN_USER_PASSWORD_AUTH"
    ) {
      const { USERNAME, PASSWORD } = AuthParameters;
      if (!USERNAME || !PASSWORD) {
        throw new InvalidParameterError("USERNAME and PASSWORD are required.");
      }

      const user = ctx.userPoolStore.getUserByUsername(UserPoolId, USERNAME);
      if (!user) {
        throw new NotAuthorizedError();
      }
      if (!user.enabled) {
        throw new NotAuthorizedError("User is disabled.");
      }
      if (user.status === "UNCONFIRMED") {
        throw new UserNotConfirmedError();
      }
      if (user.password !== PASSWORD) {
        throw new NotAuthorizedError();
      }

      // FORCE_CHANGE_PASSWORD → NEW_PASSWORD_REQUIRED challenge
      if (user.status === "FORCE_CHANGE_PASSWORD") {
        const session = ctx.tokenStore.createSession(
          "NEW_PASSWORD_REQUIRED",
          user.username,
          ClientId,
          UserPoolId,
          { admin: true }
        );
        res.json({
          ChallengeName: "NEW_PASSWORD_REQUIRED",
          ChallengeParameters: {
            USER_ID_FOR_SRP: user.username,
            requiredAttributes: JSON.stringify([]),
            userAttributes: JSON.stringify(user.attributes),
          },
          Session: session,
        });
        return;
      }

      const scope = client.allowedOAuthScopes.join(" ") || "openid";
      const tokens = generateTokens(
        user,
        ClientId,
        ctx.keys,
        issuer,
        scope,
        client.accessTokenValidity
      );
      const refreshToken = ctx.tokenStore.createRefreshToken(
        user.username,
        ClientId,
        UserPoolId,
        client.refreshTokenValidity
      );
      ctx.userPoolStore.recordRefreshTokenForUser(
        UserPoolId,
        user.username,
        refreshToken
      );

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
      const entry = ctx.tokenStore.getRefreshToken(REFRESH_TOKEN);
      if (!entry || entry.clientId !== ClientId) {
        throw new NotAuthorizedError("Invalid refresh token.");
      }
      const user = ctx.userPoolStore.getUser(UserPoolId, entry.userId);
      if (!user || !user.enabled) {
        throw new NotAuthorizedError();
      }
      const scope = client.allowedOAuthScopes.join(" ") || "openid";
      const tokens = generateTokens(
        user,
        ClientId,
        ctx.keys,
        issuer,
        scope,
        client.accessTokenValidity
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
