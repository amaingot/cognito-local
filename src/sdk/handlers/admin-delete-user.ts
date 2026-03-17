import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  userNotFoundError,
  invalidParameterError,
  resourceNotFoundError,
} from "../errors";

export function adminDeleteUserHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, Username } = req.body;

    if (!UserPoolId || !Username) {
      invalidParameterError(res, "UserPoolId and Username are required.");
      return;
    }

    const pool = ctx.userPoolStore.getPool(UserPoolId);
    if (!pool) {
      resourceNotFoundError(res, `User pool ${UserPoolId} does not exist.`);
      return;
    }

    const user = ctx.userPoolStore.getUser(UserPoolId, Username);
    if (!user) {
      userNotFoundError(res);
      return;
    }

    ctx.userPoolStore.deleteUser(UserPoolId, Username);
    ctx.tokenStore.revokeUserTokens(Username);

    res.json({});
  };
}
