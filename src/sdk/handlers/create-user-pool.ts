import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { AppContext } from "../../index";
import { InvalidParameterError } from "../../errors";
import {
  DEFAULT_PASSWORD_POLICY,
  DEFAULT_SCHEMA_ATTRIBUTES,
  SchemaAttribute,
  UserPool,
} from "../../types";

interface InboundSchema {
  Name: string;
  AttributeDataType?: SchemaAttribute["attributeDataType"];
  Required?: boolean;
  Mutable?: boolean;
  DeveloperOnlyAttribute?: boolean;
  StringAttributeConstraints?: { MinLength?: string; MaxLength?: string };
  NumberAttributeConstraints?: { MinValue?: string; MaxValue?: string };
}

export function createUserPoolHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const {
      PoolName,
      Schema,
      UsernameAttributes,
      AutoVerifiedAttributes,
      MfaConfiguration,
      Policies,
      UsernameConfiguration,
    } = req.body;

    if (!PoolName) {
      throw new InvalidParameterError("PoolName is required.");
    }

    const region = ctx.config.region;
    const poolId = `${region}_${uuidv4().replace(/-/g, "").substring(0, 9)}`;
    const now = ctx.clock.now();

    const schema: SchemaAttribute[] = Schema
      ? Schema.map((s: InboundSchema) => ({
          name: s.Name,
          attributeDataType: s.AttributeDataType ?? "String",
          required: s.Required ?? false,
          mutable: s.Mutable ?? true,
          developerOnlyAttribute: s.DeveloperOnlyAttribute ?? false,
          stringAttributeConstraints: s.StringAttributeConstraints && {
            minLength: s.StringAttributeConstraints.MinLength,
            maxLength: s.StringAttributeConstraints.MaxLength,
          },
          numberAttributeConstraints: s.NumberAttributeConstraints && {
            minValue: s.NumberAttributeConstraints.MinValue,
            maxValue: s.NumberAttributeConstraints.MaxValue,
          },
        }))
      : DEFAULT_SCHEMA_ATTRIBUTES;

    const pool: UserPool = {
      id: poolId,
      name: PoolName,
      region,
      usernameAttributes: UsernameAttributes ?? [],
      usernameCaseSensitive: UsernameConfiguration?.CaseSensitive ?? false,
      autoVerifiedAttributes: AutoVerifiedAttributes ?? [],
      mfaConfiguration: MfaConfiguration ?? "OFF",
      passwordPolicy: Policies?.PasswordPolicy
        ? {
            minimumLength:
              Policies.PasswordPolicy.MinimumLength ??
              DEFAULT_PASSWORD_POLICY.minimumLength,
            requireUppercase:
              Policies.PasswordPolicy.RequireUppercase ??
              DEFAULT_PASSWORD_POLICY.requireUppercase,
            requireLowercase:
              Policies.PasswordPolicy.RequireLowercase ??
              DEFAULT_PASSWORD_POLICY.requireLowercase,
            requireNumbers:
              Policies.PasswordPolicy.RequireNumbers ??
              DEFAULT_PASSWORD_POLICY.requireNumbers,
            requireSymbols:
              Policies.PasswordPolicy.RequireSymbols ??
              DEFAULT_PASSWORD_POLICY.requireSymbols,
            temporaryPasswordValidityDays:
              Policies.PasswordPolicy.TemporaryPasswordValidityDays ??
              DEFAULT_PASSWORD_POLICY.temporaryPasswordValidityDays,
          }
        : DEFAULT_PASSWORD_POLICY,
      schema,
      arn: `arn:aws:cognito-idp:${region}:000000000000:userpool/${poolId}`,
      createdAt: now,
      updatedAt: now,
    };

    ctx.userPoolStore.createPool(pool);

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
