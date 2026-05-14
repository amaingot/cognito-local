import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  InvalidParameterError,
  ResourceNotFoundError,
  UserNotFoundError,
} from "../../errors";

export function adminUserGlobalSignOutHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, Username } = req.body;
    if (!UserPoolId || !Username) {
      throw new InvalidParameterError(
        "UserPoolId and Username are required."
      );
    }
    const pool = ctx.userPoolStore.getPool(UserPoolId);
    if (!pool) {
      throw new ResourceNotFoundError(
        `User pool ${UserPoolId} does not exist.`
      );
    }
    const user = ctx.userPoolStore.getUserByUsername(UserPoolId, Username);
    if (!user) throw new UserNotFoundError();

    const removed = ctx.userPoolStore.clearRefreshTokensForUser(
      UserPoolId,
      user.username
    );
    for (const t of removed) ctx.tokenStore.revokeRefreshToken(t);
    ctx.tokenStore.revokeUserTokens(user.username, UserPoolId);

    res.json({});
  };
}
