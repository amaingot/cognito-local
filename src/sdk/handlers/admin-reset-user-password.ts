import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  InvalidParameterError,
  ResourceNotFoundError,
  UserNotFoundError,
} from "../../errors";

export function adminResetUserPasswordHandler(ctx: AppContext) {
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

    const code = ctx.userPoolStore.generateConfirmationCode();
    ctx.userPoolStore.updateUser({
      ...user,
      status: "RESET_REQUIRED",
      confirmationCode: code,
      updatedAt: ctx.clock.now().toISOString(),
    });

    ctx.logger.info(
      { email: user.email, code },
      "AdminResetUserPassword: reset code issued"
    );

    res.json({});
  };
}
