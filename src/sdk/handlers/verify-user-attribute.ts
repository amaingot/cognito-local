import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  CodeMismatchError,
  InvalidParameterError,
} from "../../errors";
import { resolveUserFromAccessToken } from "../access-token";

export function verifyUserAttributeHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { AccessToken, AttributeName, Code } = req.body;
    if (!AccessToken || !AttributeName || !Code) {
      throw new InvalidParameterError(
        "AccessToken, AttributeName, and Code are required."
      );
    }

    const { user } = resolveUserFromAccessToken(ctx, AccessToken);

    if (user.attributeVerificationCode !== Code) {
      throw new CodeMismatchError();
    }

    ctx.userPoolStore.updateUser({
      ...user,
      attributes: {
        ...user.attributes,
        [`${AttributeName}_verified`]: "true",
      },
      attributeVerificationCode: undefined,
      updatedAt: ctx.clock.now().toISOString(),
    });

    res.json({});
  };
}
