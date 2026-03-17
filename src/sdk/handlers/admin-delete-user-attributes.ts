import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  userNotFoundError,
  invalidParameterError,
  resourceNotFoundError,
} from "../errors";

export function adminDeleteUserAttributesHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, Username, UserAttributeNames } = req.body;

    if (!UserPoolId || !Username || !UserAttributeNames) {
      invalidParameterError(
        res,
        "UserPoolId, Username, and UserAttributeNames are required."
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
    for (const name of UserAttributeNames) {
      delete updatedAttributes[name];
    }

    ctx.userPoolStore.updateUser({
      ...user,
      attributes: updatedAttributes,
      updatedAt: new Date().toISOString(),
    });

    res.json({});
  };
}
