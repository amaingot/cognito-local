import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  CodeMismatchError,
  InvalidParameterError,
  ResourceNotFoundError,
  UserNotFoundError,
} from "../../errors";
import { triggerEvent } from "../../triggers";

export function confirmSignUpHandler(ctx: AppContext) {
  return async (req: Request, res: Response): Promise<void> => {
    const { ClientId, Username, ConfirmationCode, ClientMetadata } = req.body;

    if (!ClientId || !Username || !ConfirmationCode) {
      throw new InvalidParameterError(
        "ClientId, Username, and ConfirmationCode are required."
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

    const updated = {
      ...user,
      status: "CONFIRMED" as const,
      confirmationCode: undefined,
      attributes: {
        ...user.attributes,
        email_verified: "true",
      },
      updatedAt: ctx.clock.now().toISOString(),
    };
    ctx.userPoolStore.updateUser(updated);

    const pool = ctx.userPoolStore.getPool(client.userPoolId);
    if (pool && ctx.triggers.enabled(pool, "postConfirmation")) {
      const event = triggerEvent({
        triggerSource: "PostConfirmation_ConfirmSignUp",
        userPoolId: pool.id,
        username: updated.username,
        region: pool.region,
        clientId: ClientId,
        userAttributes: {
          ...updated.attributes,
          "cognito:user_status": updated.status,
        },
        request: { clientMetadata: ClientMetadata },
      });
      try {
        await ctx.triggers.fire(pool, "postConfirmation", event);
      } catch (err) {
        ctx.logger.warn({ err }, "PostConfirmation trigger failed");
      }
    }

    res.json({});
  };
}
