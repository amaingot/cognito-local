import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  InvalidParameterError,
  ResourceNotFoundError,
  UserNotFoundError,
} from "../../errors";

/**
 * AdminDisableUser — sets enabled=false AND clears stored refresh tokens,
 * so a disabled user cannot continue to mint access tokens via the
 * refresh-token grant.
 */
export function adminDisableUserHandler(ctx: AppContext) {
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

    // Disable + revoke all refresh tokens (#381)
    const removed = ctx.userPoolStore.clearRefreshTokensForUser(
      UserPoolId,
      user.username
    );
    for (const t of removed) ctx.tokenStore.revokeRefreshToken(t);
    ctx.tokenStore.revokeUserTokens(user.username, UserPoolId);

    ctx.userPoolStore.updateUser({
      ...user,
      enabled: false,
      updatedAt: ctx.clock.now().toISOString(),
    });

    res.json({});
  };
}
