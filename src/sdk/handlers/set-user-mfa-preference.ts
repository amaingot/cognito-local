import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError } from "../../errors";
import { resolveUserFromAccessToken } from "../access-token";

export function setUserMFAPreferenceHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const {
      AccessToken,
      SMSMfaSettings,
      SoftwareTokenMfaSettings,
    } = req.body;
    if (!AccessToken) {
      throw new InvalidParameterError("AccessToken is required.");
    }
    const { user } = resolveUserFromAccessToken(ctx, AccessToken);

    const settings = new Set(user.userMfaSettingList ?? []);
    let preferred = user.preferredMfaSetting;

    if (SMSMfaSettings) {
      if (SMSMfaSettings.Enabled) settings.add("SMS_MFA");
      else settings.delete("SMS_MFA");
      if (SMSMfaSettings.PreferredMfa) preferred = "SMS_MFA";
    }
    if (SoftwareTokenMfaSettings) {
      if (SoftwareTokenMfaSettings.Enabled) settings.add("SOFTWARE_TOKEN_MFA");
      else settings.delete("SOFTWARE_TOKEN_MFA");
      if (SoftwareTokenMfaSettings.PreferredMfa)
        preferred = "SOFTWARE_TOKEN_MFA";
    }

    ctx.userPoolStore.updateUser({
      ...user,
      userMfaSettingList: Array.from(settings),
      preferredMfaSetting: preferred,
      updatedAt: ctx.clock.now().toISOString(),
    });
    res.json({});
  };
}

export function adminSetUserMFAPreferenceHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const {
      UserPoolId,
      Username,
      SMSMfaSettings,
      SoftwareTokenMfaSettings,
    } = req.body;
    if (!UserPoolId || !Username) {
      throw new InvalidParameterError(
        "UserPoolId and Username are required."
      );
    }
    const user = ctx.userPoolStore.getUserByUsername(UserPoolId, Username);
    if (!user) {
      throw new InvalidParameterError("User not found.");
    }
    const settings = new Set(user.userMfaSettingList ?? []);
    let preferred = user.preferredMfaSetting;
    if (SMSMfaSettings) {
      if (SMSMfaSettings.Enabled) settings.add("SMS_MFA");
      else settings.delete("SMS_MFA");
      if (SMSMfaSettings.PreferredMfa) preferred = "SMS_MFA";
    }
    if (SoftwareTokenMfaSettings) {
      if (SoftwareTokenMfaSettings.Enabled) settings.add("SOFTWARE_TOKEN_MFA");
      else settings.delete("SOFTWARE_TOKEN_MFA");
      if (SoftwareTokenMfaSettings.PreferredMfa)
        preferred = "SOFTWARE_TOKEN_MFA";
    }
    ctx.userPoolStore.updateUser({
      ...user,
      userMfaSettingList: Array.from(settings),
      preferredMfaSetting: preferred,
      updatedAt: ctx.clock.now().toISOString(),
    });
    res.json({});
  };
}
