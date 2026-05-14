import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError, ResourceNotFoundError } from "../../errors";

export function getUserPoolMfaConfigHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId } = req.body;
    if (!UserPoolId) {
      throw new InvalidParameterError("UserPoolId is required.");
    }
    const pool = ctx.userPoolStore.getPool(UserPoolId);
    if (!pool) {
      throw new ResourceNotFoundError(
        `User pool ${UserPoolId} does not exist.`
      );
    }
    res.json({
      MfaConfiguration: pool.mfaConfiguration,
      SmsMfaConfiguration: pool.smsConfiguration,
      SoftwareTokenMfaConfiguration: { Enabled: true },
    });
  };
}

export function setUserPoolMfaConfigHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, MfaConfiguration, SmsMfaConfiguration } = req.body;
    if (!UserPoolId) {
      throw new InvalidParameterError("UserPoolId is required.");
    }
    const pool = ctx.userPoolStore.getPool(UserPoolId);
    if (!pool) {
      throw new ResourceNotFoundError(
        `User pool ${UserPoolId} does not exist.`
      );
    }
    ctx.userPoolStore.updatePool({
      ...pool,
      mfaConfiguration: MfaConfiguration ?? pool.mfaConfiguration,
      smsConfiguration: SmsMfaConfiguration?.SmsConfiguration && {
        snsCallerArn: SmsMfaConfiguration.SmsConfiguration.SnsCallerArn,
        externalId: SmsMfaConfiguration.SmsConfiguration.ExternalId,
      },
    });
    res.json({
      MfaConfiguration: MfaConfiguration ?? pool.mfaConfiguration,
    });
  };
}
