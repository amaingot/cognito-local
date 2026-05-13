import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  InvalidParameterError,
  ResourceNotFoundError,
  UserNotFoundError,
} from "../../errors";

/**
 * AdminUpdateUserAttributes — throws UserNotFoundException when the user
 * does not exist (real Cognito returns UserNotFoundException here, not
 * NotAuthorizedException).
 */
export function adminUpdateUserAttributesHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, Username, UserAttributes } = req.body;

    if (!UserPoolId || !Username || !UserAttributes) {
      throw new InvalidParameterError(
        "UserPoolId, Username, and UserAttributes are required."
      );
    }

    const pool = ctx.userPoolStore.getPool(UserPoolId);
    if (!pool) {
      throw new ResourceNotFoundError(
        `User pool ${UserPoolId} does not exist.`
      );
    }

    const user = ctx.userPoolStore.getUserByUsername(UserPoolId, Username);
    if (!user) {
      throw new UserNotFoundError(); // #380 — was NotAuthorizedError
    }

    const updatedAttributes = { ...user.attributes };
    for (const attr of UserAttributes) {
      updatedAttributes[attr.Name] = attr.Value;
    }

    const emailAttr = UserAttributes.find(
      (a: { Name: string }) => a.Name === "email"
    );

    ctx.userPoolStore.updateUser({
      ...user,
      attributes: updatedAttributes,
      email: emailAttr ? emailAttr.Value.toLowerCase() : user.email,
      updatedAt: ctx.clock.now().toISOString(),
    });

    res.json({});
  };
}
