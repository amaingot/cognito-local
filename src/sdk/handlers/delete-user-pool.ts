import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError, ResourceNotFoundError } from "../../errors";

export function deleteUserPoolHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId } = req.body;
    if (!UserPoolId) {
      throw new InvalidParameterError("UserPoolId is required.");
    }
    const pool = ctx.userPoolStore.getPool(UserPoolId);
    if (!pool) {
      throw new ResourceNotFoundError(
        `User pool ${UserPoolId} does not exist.`
      );
    }
    // Cascade delete clients
    for (const c of ctx.clientStore.getClientsByPool(UserPoolId)) {
      ctx.clientStore.deleteClient(c.clientId);
    }
    ctx.userPoolStore.deletePool(UserPoolId);
    res.json({});
  };
}
