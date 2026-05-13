import { Request, Response } from "express";
import { authenticator } from "otplib";
import { AppContext } from "../../index";
import {
  EnableSoftwareTokenMfaError,
  InvalidParameterError,
  NotAuthorizedError,
} from "../../errors";
import { resolveUserFromAccessToken } from "../access-token";

export function verifySoftwareTokenHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { AccessToken, Session, UserCode, FriendlyDeviceName } = req.body;

    if (!UserCode) {
      throw new InvalidParameterError("UserCode is required.");
    }

    let username: string;
    let poolId: string;
    if (AccessToken) {
      const { user } = resolveUserFromAccessToken(ctx, AccessToken);
      username = user.username;
      poolId = user.userPoolId;
    } else if (Session) {
      const entry = ctx.tokenStore.getSession(Session);
      if (!entry) throw new NotAuthorizedError("Invalid session.");
      username = entry.username;
      poolId = entry.userPoolId;
    } else {
      throw new InvalidParameterError(
        "AccessToken or Session is required."
      );
    }

    const user = ctx.userPoolStore.getUser(poolId, username);
    if (!user?.softwareTokenMfa?.secret) {
      throw new EnableSoftwareTokenMfaError(
        "Software token MFA is not configured for this user."
      );
    }

    const ok = authenticator.check(UserCode, user.softwareTokenMfa.secret);
    if (!ok) {
      res.json({ Status: "ERROR" });
      return;
    }

    ctx.userPoolStore.updateUser({
      ...user,
      softwareTokenMfa: {
        ...user.softwareTokenMfa,
        enabled: true,
        friendlyDeviceName: FriendlyDeviceName,
      },
      userMfaSettingList: [
        ...new Set([...(user.userMfaSettingList ?? []), "SOFTWARE_TOKEN_MFA"]),
      ],
      preferredMfaSetting:
        user.preferredMfaSetting ?? "SOFTWARE_TOKEN_MFA",
      updatedAt: ctx.clock.now().toISOString(),
    });

    res.json({
      Status: "SUCCESS",
      Session: Session
        ? ctx.tokenStore.createSession(
            "MFA_SETUP",
            user.username,
            "",
            poolId
          )
        : undefined,
    });
  };
}
