import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  InvalidParameterError,
  ResourceNotFoundError,
  UserNotFoundError,
} from "../../errors";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  const masked =
    local.length <= 2 ? "***" : local[0] + "***" + local[local.length - 1];
  return `${masked}@${domain}`;
}

export function forgotPasswordHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { ClientId, Username } = req.body;
    if (!ClientId || !Username) {
      throw new InvalidParameterError(
        "ClientId and Username are required."
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

    const code = ctx.userPoolStore.generateConfirmationCode();
    ctx.userPoolStore.updateUser({
      ...user,
      confirmationCode: code,
      status: "RESET_REQUIRED",
      updatedAt: ctx.clock.now().toISOString(),
    });

    ctx.logger.info(
      { email: user.email, code },
      "ForgotPassword: confirmation code issued"
    );

    res.json({
      CodeDeliveryDetails: {
        Destination: maskEmail(user.email),
        DeliveryMedium: "EMAIL",
        AttributeName: "email",
      },
    });
  };
}
