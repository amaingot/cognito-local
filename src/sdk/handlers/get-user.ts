import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError } from "../../errors";
import { resolveUserFromAccessToken } from "../access-token";
import { renderUserAttributes } from "../../util/attributes";

export function getUserHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { AccessToken } = req.body;
    if (!AccessToken) {
      throw new InvalidParameterError("AccessToken is required.");
    }

    const { user, pool } = resolveUserFromAccessToken(ctx, AccessToken);

    res.json({
      Username: user.username,
      UserAttributes: renderUserAttributes(user, pool),
      MFAOptions: user.mfaOptions?.map((o) => ({
        DeliveryMedium: o.deliveryMedium,
        AttributeName: o.attributeName,
      })),
      PreferredMfaSetting: user.preferredMfaSetting,
      UserMFASettingList: user.userMfaSettingList,
    });
  };
}
