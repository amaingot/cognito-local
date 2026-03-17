import { Request, Response } from "express";
import { AppContext } from "../../index";
import { invalidParameterError, resourceNotFoundError } from "../errors";

export function describeUserPoolHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId } = req.body;

    if (!UserPoolId) {
      invalidParameterError(res, "UserPoolId is required.");
      return;
    }

    const pool = ctx.userPoolStore.getPool(UserPoolId);
    if (!pool) {
      resourceNotFoundError(res, `User pool ${UserPoolId} does not exist.`);
      return;
    }

    res.json({
      UserPool: {
        Id: pool.id,
        Name: pool.name,
        Status: "Enabled",
        LastModifiedDate: pool.updatedAt,
        CreationDate: pool.createdAt,
        SchemaAttributes: pool.schema.map((s) => ({
          Name: s.name,
          AttributeDataType: s.attributeDataType,
          Required: s.required,
          Mutable: s.mutable,
        })),
        UsernameAttributes: pool.usernameAttributes,
      },
    });
  };
}
