import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  resourceNotFoundError,
  userNotFoundError,
  codeMismatchError,
  invalidParameterError,
} from "../errors";

export function confirmSignUpHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { ClientId, Username, ConfirmationCode } = req.body;

    if (!ClientId || !Username || !ConfirmationCode) {
      invalidParameterError(
        res,
        "ClientId, Username, and ConfirmationCode are required."
      );
      return;
    }

    const client = ctx.clientStore.getClient(ClientId);
    if (!client) {
      resourceNotFoundError(res, `Client ${ClientId} not found.`);
      return;
    }

    const poolId = client.userPoolId;
    const user = ctx.userPoolStore.getUser(poolId, Username);
    if (!user) {
      userNotFoundError(res);
      return;
    }

    if (user.confirmationCode !== ConfirmationCode) {
      codeMismatchError(res);
      return;
    }

    ctx.userPoolStore.updateUser({
      ...user,
      status: "CONFIRMED",
      confirmationCode: undefined,
      attributes: {
        ...user.attributes,
        email_verified: "true",
      },
      updatedAt: new Date().toISOString(),
    });

    res.json({});
  };
}
