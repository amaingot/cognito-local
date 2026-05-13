import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  InvalidParameterError,
  ResourceNotFoundError,
} from "../../errors";
import { SchemaAttribute } from "../../types";

export function addCustomAttributesHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, CustomAttributes } = req.body;
    if (!UserPoolId || !CustomAttributes) {
      throw new InvalidParameterError(
        "UserPoolId and CustomAttributes are required."
      );
    }
    const pool = ctx.userPoolStore.getPool(UserPoolId);
    if (!pool) {
      throw new ResourceNotFoundError(
        `User pool ${UserPoolId} does not exist.`
      );
    }

    const newAttrs: SchemaAttribute[] = CustomAttributes.map(
      (a: {
        Name: string;
        AttributeDataType?: SchemaAttribute["attributeDataType"];
        DeveloperOnlyAttribute?: boolean;
        Mutable?: boolean;
        Required?: boolean;
        StringAttributeConstraints?: { MinLength?: string; MaxLength?: string };
        NumberAttributeConstraints?: { MinValue?: string; MaxValue?: string };
      }) => {
        const bare = a.Name.startsWith("custom:")
          ? a.Name.slice("custom:".length)
          : a.Name;
        return {
          name: `custom:${bare}`,
          attributeDataType: a.AttributeDataType ?? "String",
          required: a.Required ?? false,
          mutable: a.Mutable ?? true,
          developerOnlyAttribute: a.DeveloperOnlyAttribute ?? false,
          stringAttributeConstraints: a.StringAttributeConstraints && {
            minLength: a.StringAttributeConstraints.MinLength,
            maxLength: a.StringAttributeConstraints.MaxLength,
          },
          numberAttributeConstraints: a.NumberAttributeConstraints && {
            minValue: a.NumberAttributeConstraints.MinValue,
            maxValue: a.NumberAttributeConstraints.MaxValue,
          },
        };
      }
    );

    ctx.userPoolStore.updatePool({
      ...pool,
      schema: [...pool.schema, ...newAttrs],
    });

    res.json({});
  };
}
