import { Request, Response } from "express";
import { AppContext } from "../../index";
import { generateTokens } from "../../tokens/generate";
import {
  resourceNotFoundError,
  notAuthorizedError,
  userNotFoundError,
  invalidParameterError,
} from "../errors";

export function initiateAuthHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { AuthFlow, ClientId, AuthParameters } = req.body;

    if (!AuthFlow || !ClientId || !AuthParameters) {
      invalidParameterError(res, "AuthFlow, ClientId, and AuthParameters are required.");
      return;
    }

    const client = ctx.clientStore.getClient(ClientId);
    if (!client) {
      resourceNotFoundError(res, `Client ${ClientId} not found.`);
      return;
    }

    const poolId = client.userPoolId;
    const issuer = `${ctx.config.issuerHost}/${ctx.config.userPoolId}`;

    if (AuthFlow === "USER_SRP_AUTH") {
      invalidParameterError(
        res,
        "USER_SRP_AUTH is not supported by cognito-local. Use USER_PASSWORD_AUTH instead."
      );
      return;
    }

    if (AuthFlow === "USER_PASSWORD_AUTH") {
      const { USERNAME, PASSWORD } = AuthParameters;

      if (!USERNAME || !PASSWORD) {
        invalidParameterError(res, "USERNAME and PASSWORD are required.");
        return;
      }

      // Look up user by username or email
      let user = ctx.userPoolStore.getUser(poolId, USERNAME);
      if (!user) {
        user = ctx.userPoolStore.getUserByEmail(poolId, USERNAME);
      }
      if (!user) {
        userNotFoundError(res);
        return;
      }

      if (!user.enabled) {
        notAuthorizedError(res, "User is disabled.");
        return;
      }

      if (user.status !== "CONFIRMED") {
        notAuthorizedError(res, "User is not confirmed.");
        return;
      }

      if (user.password !== PASSWORD) {
        notAuthorizedError(res);
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
        poolId,
        client.refreshTokenValidity
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
        invalidParameterError(res, "REFRESH_TOKEN is required.");
        return;
      }

      const tokenEntry = ctx.tokenStore.getRefreshToken(REFRESH_TOKEN);
      if (!tokenEntry) {
        notAuthorizedError(res, "Invalid refresh token.");
        return;
      }

      if (tokenEntry.clientId !== ClientId) {
        notAuthorizedError(res, "Invalid refresh token.");
        return;
      }

      const user = ctx.userPoolStore.getUser(tokenEntry.userPoolId, tokenEntry.userId);
      if (!user) {
        notAuthorizedError(res, "User no longer exists.");
        return;
      }

      if (!user.enabled) {
        notAuthorizedError(res, "User is disabled.");
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

    invalidParameterError(res, `Unsupported AuthFlow: ${AuthFlow}`);
  };
}
