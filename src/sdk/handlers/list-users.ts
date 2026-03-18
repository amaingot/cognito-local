import { Request, Response } from "express";
import { AppContext } from "../../index";
import { invalidParameterError, resourceNotFoundError } from "../errors";

export function listUsersHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, Filter, Limit, PaginationToken } = req.body;

    if (!UserPoolId) {
      invalidParameterError(res, "UserPoolId is required.");
      return;
    }

    const pool = ctx.userPoolStore.getPool(UserPoolId);
    if (!pool) {
      resourceNotFoundError(res, `User pool ${UserPoolId} does not exist.`);
      return;
    }

    const users = ctx.userPoolStore.listUsers(UserPoolId, Filter);

    // Simple pagination
    let startIndex = 0;
    if (PaginationToken) {
      startIndex = parseInt(PaginationToken, 10) || 0;
    }

    const pageSize = Limit || 60;
    const paged = users.slice(startIndex, startIndex + pageSize);

    const result: Record<string, unknown> = {
      Users: paged.map((user) => ({
        Username: user.username,
        Attributes: Object.entries(user.attributes).map(([Name, Value]) => ({
          Name,
          Value,
        })),
        UserStatus: user.status,
        Enabled: user.enabled,
        UserCreateDate: user.createdAt,
        UserLastModifiedDate: user.updatedAt,
      })),
    };

    if (startIndex + pageSize < users.length) {
      result.PaginationToken = String(startIndex + pageSize);
    }

    res.json(result);
  };
}
