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
        MfaConfiguration: pool.mfaConfiguration,
        Policies: {
          PasswordPolicy: {
            MinimumLength: pool.passwordPolicy.minimumLength,
            RequireUppercase: pool.passwordPolicy.requireUppercase,
            RequireLowercase: pool.passwordPolicy.requireLowercase,
            RequireNumbers: pool.passwordPolicy.requireNumbers,
            RequireSymbols: pool.passwordPolicy.requireSymbols,
            TemporaryPasswordValidityDays:
              pool.passwordPolicy.temporaryPasswordValidityDays,
          },
        },
        SchemaAttributes: pool.schema.map((s) => ({
          Name: s.name,
          AttributeDataType: s.attributeDataType,
          Required: s.required,
          Mutable: s.mutable,
          DeveloperOnlyAttribute: s.developerOnlyAttribute,
          StringAttributeConstraints: s.stringAttributeConstraints && {
            MinLength: s.stringAttributeConstraints.minLength,
            MaxLength: s.stringAttributeConstraints.maxLength,
          },
          NumberAttributeConstraints: s.numberAttributeConstraints && {
            MinValue: s.numberAttributeConstraints.minValue,
            MaxValue: s.numberAttributeConstraints.maxValue,
          },
        })),
        UsernameAttributes: pool.usernameAttributes,
        UsernameConfiguration: { CaseSensitive: pool.usernameCaseSensitive },
        AutoVerifiedAttributes: pool.autoVerifiedAttributes,
        Arn: pool.arn,
      },
    });
  };
}
