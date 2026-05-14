import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  CodeMismatchError,
  InvalidParameterError,
  ResourceNotFoundError,
  UserNotFoundError,
} from "../../errors";
import { validatePassword } from "../../util/password";

export function confirmForgotPasswordHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { ClientId, Username, ConfirmationCode, Password } = req.body;
    if (!ClientId || !Username || !ConfirmationCode || !Password) {
      throw new InvalidParameterError(
        "ClientId, Username, ConfirmationCode, and Password are required."
      );
    }

    const client = ctx.clientStore.getClient(ClientId);
    if (!client) {
      throw new ResourceNotFoundError(`Client ${ClientId} not found.`);
    }

    const user = ctx.userPoolStore.getUserByUsername(
      client.userPoolId,
      Username
    );
    if (!user) {
      throw new UserNotFoundError();
    }

    if (user.confirmationCode !== ConfirmationCode) {
      throw new CodeMismatchError();
    }

    const pool = ctx.userPoolStore.getPool(client.userPoolId);
    if (pool) validatePassword(Password, pool.passwordPolicy);

    ctx.userPoolStore.updateUser({
      ...user,
      password: Password,
      status: "CONFIRMED",
      confirmationCode: undefined,
      updatedAt: ctx.clock.now().toISOString(),
    });

    res.json({});
  };
}
