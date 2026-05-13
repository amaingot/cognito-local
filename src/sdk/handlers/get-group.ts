import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError, ResourceNotFoundError } from "../../errors";

export function getGroupHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { GroupName, UserPoolId } = req.body;
    if (!GroupName || !UserPoolId) {
      throw new InvalidParameterError(
        "UserPoolId and GroupName are required."
      );
    }
    const group = ctx.groupStore.getGroup(UserPoolId, GroupName);
    if (!group) {
      throw new ResourceNotFoundError(`Group ${GroupName} not found.`);
    }
    res.json({
      Group: {
        GroupName: group.groupName,
        UserPoolId: group.userPoolId,
        Description: group.description,
        RoleArn: group.roleArn,
        Precedence: group.precedence,
        CreationDate: group.createdAt,
        LastModifiedDate: group.updatedAt,
      },
    });
  };
}
