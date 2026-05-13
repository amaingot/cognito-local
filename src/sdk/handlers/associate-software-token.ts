import { Request, Response } from "express";
import { authenticator } from "otplib";
import { AppContext } from "../../index";
import { InvalidParameterError, NotAuthorizedError } from "../../errors";
import { resolveUserFromAccessToken } from "../access-token";

export function associateSoftwareTokenHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { AccessToken, Session } = req.body;

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
    if (!user) throw new NotAuthorizedError();

    const secret = authenticator.generateSecret();
    ctx.userPoolStore.updateUser({
      ...user,
      softwareTokenMfa: { enabled: false, secret },
      updatedAt: ctx.clock.now().toISOString(),
    });

    const nextSession = ctx.tokenStore.createSession(
      "MFA_SETUP",
      user.username,
      "",
      poolId,
      { previousSession: Session }
    );

    res.json({
      SecretCode: secret,
      Session: nextSession,
    });
  };
}
