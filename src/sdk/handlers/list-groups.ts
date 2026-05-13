import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError, ResourceNotFoundError } from "../../errors";

export function listGroupsHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, Limit, NextToken } = req.body;
    if (!UserPoolId) {
      throw new InvalidParameterError("UserPoolId is required.");
    }
    if (!ctx.userPoolStore.getPool(UserPoolId)) {
      throw new ResourceNotFoundError(
        `User pool ${UserPoolId} does not exist.`
      );
    }
    const all = ctx.groupStore.listGroupsForPool(UserPoolId);
    const start = NextToken ? parseInt(NextToken, 10) || 0 : 0;
    const pageSize = Limit || 60;
    const page = all.slice(start, start + pageSize);
    const next =
      start + pageSize < all.length ? String(start + pageSize) : undefined;
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
