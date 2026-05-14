import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError, ResourceNotFoundError } from "../../errors";

export function updateGroupHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { GroupName, UserPoolId, Description, RoleArn, Precedence } = req.body;
    if (!GroupName || !UserPoolId) {
      throw new InvalidParameterError(
        "UserPoolId and GroupName are required."
      );
    }
    const group = ctx.groupStore.getGroup(UserPoolId, GroupName);
    if (!group) {
      throw new ResourceNotFoundError(`Group ${GroupName} not found.`);
    }
    const updated = {
      ...group,
      description: Description ?? group.description,
      roleArn: RoleArn ?? group.roleArn,
      precedence: Precedence ?? group.precedence,
    };
    ctx.groupStore.updateGroup(updated);
    res.json({
      Group: {
        GroupName: updated.groupName,
        UserPoolId: updated.userPoolId,
        Description: updated.description,
        RoleArn: updated.roleArn,
        Precedence: updated.precedence,
        CreationDate: updated.createdAt,
        LastModifiedDate: updated.updatedAt,
      },
    });
  };
}
