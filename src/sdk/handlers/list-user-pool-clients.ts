import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError, ResourceNotFoundError } from "../../errors";

export function listUserPoolClientsHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, MaxResults, NextToken } = req.body;
    if (!UserPoolId) {
      throw new InvalidParameterError("UserPoolId is required.");
    }
    const pool = ctx.userPoolStore.getPool(UserPoolId);
    if (!pool) {
      throw new ResourceNotFoundError(
        `User pool ${UserPoolId} does not exist.`
      );
    }
    const all = ctx.clientStore.getClientsByPool(UserPoolId);
    const start = NextToken ? parseInt(NextToken, 10) || 0 : 0;
    const pageSize = MaxResults || 60;
    const page = all.slice(start, start + pageSize);
    const next =
      start + pageSize < all.length ? String(start + pageSize) : undefined;
    res.json({
      UserPoolClients: page.map((c) => ({
        ClientId: c.clientId,
        ClientName: c.clientName,
        UserPoolId: c.userPoolId,
      })),
      NextToken: next,
    });
  };
}
