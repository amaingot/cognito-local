import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError } from "../../errors";
import { resolveUserFromAccessToken } from "../access-token";

export function globalSignOutHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { AccessToken } = req.body;
    if (!AccessToken) {
      throw new InvalidParameterError("AccessToken is required.");
    }

    const { user } = resolveUserFromAccessToken(ctx, AccessToken);

    const removed = ctx.userPoolStore.clearRefreshTokensForUser(
      user.userPoolId,
      user.username
    );
    for (const t of removed) {
      ctx.tokenStore.revokeRefreshToken(t);
    }
    ctx.tokenStore.revokeUserTokens(user.username, user.userPoolId);

    res.json({});
  };
}
