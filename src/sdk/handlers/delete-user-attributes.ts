import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError } from "../../errors";
import { resolveUserFromAccessToken } from "../access-token";

export function deleteUserAttributesHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { AccessToken, UserAttributeNames } = req.body;
    if (!AccessToken || !UserAttributeNames) {
      throw new InvalidParameterError(
        "AccessToken and UserAttributeNames are required."
      );
    }

    const { user } = resolveUserFromAccessToken(ctx, AccessToken);

    const updated = { ...user.attributes };
    for (const name of UserAttributeNames) {
      delete updated[name];
    }

    ctx.userPoolStore.updateUser({
      ...user,
      attributes: updated,
      updatedAt: ctx.clock.now().toISOString(),
    });

    res.json({});
  };
}
