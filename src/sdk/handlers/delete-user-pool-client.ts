import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError, ResourceNotFoundError } from "../../errors";

export function deleteUserPoolClientHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, ClientId } = req.body;
    if (!UserPoolId || !ClientId) {
      throw new InvalidParameterError(
        "UserPoolId and ClientId are required."
      );
    }
    const client = ctx.clientStore.getClient(ClientId);
    if (!client || client.userPoolId !== UserPoolId) {
      throw new ResourceNotFoundError(`Client ${ClientId} not found.`);
    }
    ctx.clientStore.deleteClient(ClientId);
    res.json({});
  };
}
