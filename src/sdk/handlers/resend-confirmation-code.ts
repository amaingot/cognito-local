import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  resourceNotFoundError,
  userNotFoundError,
  invalidParameterError,
} from "../errors";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const masked =
    local.length <= 2
      ? "***"
      : local[0] + "***" + local[local.length - 1];
  return `${masked}@${domain}`;
}

export function resendConfirmationCodeHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { ClientId, Username } = req.body;

    if (!ClientId || !Username) {
      invalidParameterError(res, "ClientId and Username are required.");
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

    const confirmationCode = ctx.userPoolStore.generateConfirmationCode();

    console.log(
      `[ResendConfirmationCode] User ${user.email} new confirmation code: ${confirmationCode}`
    );

    ctx.userPoolStore.updateUser({
      ...user,
      confirmationCode,
      updatedAt: new Date().toISOString(),
    });

    res.json({
      CodeDeliveryDetails: {
        Destination: maskEmail(user.email),
        DeliveryMedium: "EMAIL",
        AttributeName: "email",
      },
    });
  };
}
