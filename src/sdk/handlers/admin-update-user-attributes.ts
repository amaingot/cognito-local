import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  userNotFoundError,
  invalidParameterError,
  resourceNotFoundError,
} from "../errors";

export function adminUpdateUserAttributesHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, Username, UserAttributes } = req.body;

    if (!UserPoolId || !Username || !UserAttributes) {
      invalidParameterError(
        res,
        "UserPoolId, Username, and UserAttributes are required."
      );
      return;
    }

    const pool = ctx.userPoolStore.getPool(UserPoolId);
    if (!pool) {
      resourceNotFoundError(res, `User pool ${UserPoolId} does not exist.`);
      return;
    }

    const user = ctx.userPoolStore.getUser(UserPoolId, Username);
    if (!user) {
      userNotFoundError(res);
      return;
    }

    const updatedAttributes = { ...user.attributes };
    for (const attr of UserAttributes) {
      updatedAttributes[attr.Name] = attr.Value;
    }

    // If email was updated, also update the top-level email field
    const emailAttr = UserAttributes.find(
      (a: { Name: string }) => a.Name === "email"
    );

    ctx.userPoolStore.updateUser({
      ...user,
      attributes: updatedAttributes,
      email: emailAttr ? emailAttr.Value.toLowerCase() : user.email,
      updatedAt: new Date().toISOString(),
    });

    res.json({});
  };
}
