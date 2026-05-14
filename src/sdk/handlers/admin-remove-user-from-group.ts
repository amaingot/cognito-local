import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  InvalidParameterError,
  ResourceNotFoundError,
  UserNotFoundError,
} from "../../errors";

export function adminRemoveUserFromGroupHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, Username, GroupName } = req.body;
    if (!UserPoolId || !Username || !GroupName) {
      throw new InvalidParameterError(
        "UserPoolId, Username, and GroupName are required."
      );
    }
    const user = ctx.userPoolStore.getUserByUsername(UserPoolId, Username);
    if (!user) throw new UserNotFoundError();
    const group = ctx.groupStore.getGroup(UserPoolId, GroupName);
    if (!group) {
      throw new ResourceNotFoundError(`Group ${GroupName} not found.`);
    }
    ctx.groupStore.removeMember(UserPoolId, GroupName, user.username);
    if (user.groups.includes(GroupName)) {
      ctx.userPoolStore.updateUser({
        ...user,
        groups: user.groups.filter((g) => g !== GroupName),
        updatedAt: ctx.clock.now().toISOString(),
      });
    }
    res.json({});
  };
}
