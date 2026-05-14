import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  InvalidParameterError,
  ResourceNotFoundError,
  UserNotFoundError,
} from "../../errors";

export function adminConfirmSignUpHandler(ctx: AppContext) {
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

    ctx.userPoolStore.updateUser({
      ...user,
      status: "CONFIRMED",
      attributes: { ...user.attributes, email_verified: "true" },
      confirmationCode: undefined,
      updatedAt: ctx.clock.now().toISOString(),
    });

    res.json({});
  };
}
