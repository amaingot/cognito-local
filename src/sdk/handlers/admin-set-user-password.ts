import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  InvalidParameterError,
  ResourceNotFoundError,
  UserNotFoundError,
} from "../../errors";
import { validatePassword } from "../../util/password";

export function adminSetUserPasswordHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, Username, Password, Permanent } = req.body;
    if (!UserPoolId || !Username || !Password) {
      throw new InvalidParameterError(
        "UserPoolId, Username, and Password are required."
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

    validatePassword(Password, pool.passwordPolicy);

    ctx.userPoolStore.updateUser({
      ...user,
      password: Password,
      status: Permanent ? "CONFIRMED" : "FORCE_CHANGE_PASSWORD",
      updatedAt: ctx.clock.now().toISOString(),
    });

    res.json({});
  };
}
