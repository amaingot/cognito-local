import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  GroupExistsError,
  InvalidParameterError,
  ResourceNotFoundError,
} from "../../errors";

export function createGroupHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { GroupName, UserPoolId, Description, RoleArn, Precedence } = req.body;
    if (!UserPoolId || !GroupName) {
      throw new InvalidParameterError(
        "UserPoolId and GroupName are required."
      );
    }
    if (!ctx.userPoolStore.getPool(UserPoolId)) {
      throw new ResourceNotFoundError(
        `User pool ${UserPoolId} does not exist.`
      );
    }
    if (ctx.groupStore.getGroup(UserPoolId, GroupName)) {
      throw new GroupExistsError();
    }
    const now = ctx.clock.now().toISOString();
    ctx.groupStore.createGroup({
      groupName: GroupName,
      description: Description,
      precedence: Precedence,
      roleArn: RoleArn,
      userPoolId: UserPoolId,
      members: [],
      createdAt: now,
      updatedAt: now,
    });
    res.json({
      Group: {
        GroupName,
        UserPoolId,
        Description,
        RoleArn,
        Precedence,
        CreationDate: now,
        LastModifiedDate: now,
      },
    });
  };
}
