import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError, ResourceNotFoundError } from "../../errors";

export function deleteGroupHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { GroupName, UserPoolId } = req.body;
    if (!GroupName || !UserPoolId) {
      throw new InvalidParameterError(
        "UserPoolId and GroupName are required."
      );
    }
    if (!ctx.groupStore.getGroup(UserPoolId, GroupName)) {
      throw new ResourceNotFoundError(`Group ${GroupName} not found.`);
    }
    ctx.groupStore.deleteGroup(UserPoolId, GroupName);
    res.json({});
  };
}
