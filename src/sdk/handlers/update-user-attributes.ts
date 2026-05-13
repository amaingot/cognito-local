import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError } from "../../errors";
import { resolveUserFromAccessToken } from "../access-token";
import { attributesArrayToRecord } from "../../util/attributes";

export function updateUserAttributesHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { AccessToken, UserAttributes } = req.body;
    if (!AccessToken || !UserAttributes) {
      throw new InvalidParameterError(
        "AccessToken and UserAttributes are required."
      );
    }

    const { user } = resolveUserFromAccessToken(ctx, AccessToken);

    const incoming = attributesArrayToRecord(UserAttributes);
    const merged = { ...user.attributes, ...incoming };
    const emailChanged = "email" in incoming && incoming.email !== user.email;

    ctx.userPoolStore.updateUser({
      ...user,
      attributes: merged,
      email: emailChanged ? incoming.email.toLowerCase() : user.email,
      updatedAt: ctx.clock.now().toISOString(),
    });

    res.json({ CodeDeliveryDetailsList: [] });
  };
}
