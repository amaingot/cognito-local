import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError } from "../../errors";
import { resolveUserFromAccessToken } from "../access-token";

export function getUserAttributeVerificationCodeHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { AccessToken, AttributeName } = req.body;
    if (!AccessToken || !AttributeName) {
      throw new InvalidParameterError(
        "AccessToken and AttributeName are required."
      );
    }

    const { user } = resolveUserFromAccessToken(ctx, AccessToken);
    const code = ctx.userPoolStore.generateConfirmationCode();
    ctx.userPoolStore.updateUser({
      ...user,
      attributeVerificationCode: code,
      updatedAt: ctx.clock.now().toISOString(),
    });

    ctx.logger.info(
      { username: user.username, AttributeName, code },
      "GetUserAttributeVerificationCode"
    );

    const isEmail = AttributeName === "email";
    res.json({
      CodeDeliveryDetails: {
        Destination: isEmail
          ? user.email
          : (user.attributes.phone_number ?? ""),
        DeliveryMedium: isEmail ? "EMAIL" : "SMS",
        AttributeName,
      },
    });
  };
}
