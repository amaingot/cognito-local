import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  InvalidParameterError,
  UserNotFoundError,
} from "../../errors";

/**
 * AdminListGroupsForUser — looks up the user first, then filters groups by
 * the resolved internal username (sub), not the request input. Group members
 * are stored by sub, so for email-username pools filtering on the raw input
 * would return empty.
 */
export function adminListGroupsForUserHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, Username, Limit, NextToken } = req.body;
    if (!UserPoolId || !Username) {
      throw new InvalidParameterError(
        "UserPoolId and Username are required."
      );
    }
    const user = ctx.userPoolStore.getUserByUsername(UserPoolId, Username);
    if (!user) throw new UserNotFoundError();

    const groups = ctx.groupStore.listGroupsForUser(UserPoolId, user.username);
    const start = NextToken ? parseInt(NextToken, 10) || 0 : 0;
    const pageSize = Limit || 60;
    const page = groups.slice(start, start + pageSize);
    const next =
      start + pageSize < groups.length ? String(start + pageSize) : undefined;
    res.json({
      Groups: page.map((g) => ({
        GroupName: g.groupName,
        UserPoolId: g.userPoolId,
        Description: g.description,
        RoleArn: g.roleArn,
        Precedence: g.precedence,
        CreationDate: g.createdAt,
        LastModifiedDate: g.updatedAt,
      })),
      NextToken: next,
    });
  };
}
