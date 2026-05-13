import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError, ResourceNotFoundError } from "../../errors";

export function updateUserPoolHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const {
      UserPoolId,
      MfaConfiguration,
      AutoVerifiedAttributes,
      Policies,
      UsernameConfiguration,
    } = req.body;
    if (!UserPoolId) {
      throw new InvalidParameterError("UserPoolId is required.");
    }
    const pool = ctx.userPoolStore.getPool(UserPoolId);
    if (!pool) {
      throw new ResourceNotFoundError(
        `User pool ${UserPoolId} does not exist.`
      );
    }

    const updated = {
      ...pool,
      mfaConfiguration: MfaConfiguration ?? pool.mfaConfiguration,
      autoVerifiedAttributes:
        AutoVerifiedAttributes ?? pool.autoVerifiedAttributes,
      usernameCaseSensitive:
        UsernameConfiguration?.CaseSensitive ?? pool.usernameCaseSensitive,
      passwordPolicy: Policies?.PasswordPolicy
        ? {
            minimumLength:
              Policies.PasswordPolicy.MinimumLength ??
              pool.passwordPolicy.minimumLength,
            requireUppercase:
              Policies.PasswordPolicy.RequireUppercase ??
              pool.passwordPolicy.requireUppercase,
            requireLowercase:
              Policies.PasswordPolicy.RequireLowercase ??
              pool.passwordPolicy.requireLowercase,
            requireNumbers:
              Policies.PasswordPolicy.RequireNumbers ??
              pool.passwordPolicy.requireNumbers,
            requireSymbols:
              Policies.PasswordPolicy.RequireSymbols ??
              pool.passwordPolicy.requireSymbols,
            temporaryPasswordValidityDays:
              Policies.PasswordPolicy.TemporaryPasswordValidityDays ??
              pool.passwordPolicy.temporaryPasswordValidityDays,
          }
        : pool.passwordPolicy,
    };
    ctx.userPoolStore.updatePool(updated);

    res.json({});
  };
}
