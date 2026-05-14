import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError } from "../../errors";
import { resolveUserFromAccessToken } from "../access-token";

export function deleteUserHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { AccessToken } = req.body;
    if (!AccessToken) {
      throw new InvalidParameterError("AccessToken is required.");
    }

    const { user } = resolveUserFromAccessToken(ctx, AccessToken);

    ctx.tokenStore.revokeUserTokens(user.username, user.userPoolId);
    ctx.userPoolStore.deleteUser(user.userPoolId, user.username);

    res.json({});
  };
}
