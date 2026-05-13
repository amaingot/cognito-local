import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError, ResourceNotFoundError } from "../../errors";

export function listUsersInGroupHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, GroupName, Limit, NextToken } = req.body;
    if (!UserPoolId || !GroupName) {
      throw new InvalidParameterError(
        "UserPoolId and GroupName are required."
      );
    }
    const group = ctx.groupStore.getGroup(UserPoolId, GroupName);
    if (!group) {
      throw new ResourceNotFoundError(`Group ${GroupName} not found.`);
    }
    const users = group.members
      .map((u) => ctx.userPoolStore.getUser(UserPoolId, u))
      .filter((u): u is NonNullable<typeof u> => u !== undefined);
    const start = NextToken ? parseInt(NextToken, 10) || 0 : 0;
    const pageSize = Limit || 60;
    const page = users.slice(start, start + pageSize);
    const next =
      start + pageSize < users.length ? String(start + pageSize) : undefined;
    res.json({
      Users: page.map((u) => ({
        Username: u.username,
        Attributes: Object.entries(u.attributes).map(([Name, Value]) => ({
          Name,
          Value,
        })),
        UserStatus: u.status,
        Enabled: u.enabled,
        UserCreateDate: u.createdAt,
        UserLastModifiedDate: u.updatedAt,
      })),
      NextToken: next,
    });
  };
}
