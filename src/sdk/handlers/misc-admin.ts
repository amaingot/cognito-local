import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError, UserNotFoundError } from "../../errors";
import { resolveUserFromAccessToken } from "../access-token";

/**
 * Minimal stubs for less-commonly-used Admin/User operations that exist for
 * AWS SDK parity but have no observable effect locally.
 */

export function adminLinkProviderForUserHandler(_ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, DestinationUser, SourceUser } = req.body;
    if (!UserPoolId || !DestinationUser || !SourceUser) {
      throw new InvalidParameterError(
        "UserPoolId, DestinationUser, and SourceUser are required."
      );
    }
    res.json({});
  };
}

export function adminDisableProviderForUserHandler(_ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, User } = req.body;
    if (!UserPoolId || !User) {
      throw new InvalidParameterError(
        "UserPoolId and User are required."
      );
    }
    res.json({});
  };
}

export function setUserSettingsHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { AccessToken, MFAOptions } = req.body;
    if (!AccessToken) {
      throw new InvalidParameterError("AccessToken is required.");
    }
    const { user } = resolveUserFromAccessToken(ctx, AccessToken);
    ctx.userPoolStore.updateUser({
      ...user,
      mfaOptions: (MFAOptions ?? []).map(
        (o: { DeliveryMedium: "SMS" | "EMAIL"; AttributeName: string }) => ({
          deliveryMedium: o.DeliveryMedium,
          attributeName: o.AttributeName,
        })
      ),
      updatedAt: ctx.clock.now().toISOString(),
    });
    res.json({});
  };
}

export function adminSetUserSettingsHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, Username, MFAOptions } = req.body;
    if (!UserPoolId || !Username) {
      throw new InvalidParameterError(
        "UserPoolId and Username are required."
      );
    }
    const user = ctx.userPoolStore.getUserByUsername(UserPoolId, Username);
    if (!user) throw new UserNotFoundError();
    ctx.userPoolStore.updateUser({
      ...user,
      mfaOptions: (MFAOptions ?? []).map(
        (o: { DeliveryMedium: "SMS" | "EMAIL"; AttributeName: string }) => ({
          deliveryMedium: o.DeliveryMedium,
          attributeName: o.AttributeName,
        })
      ),
      updatedAt: ctx.clock.now().toISOString(),
    });
    res.json({});
  };
}

export function getSigningCertificateHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId } = req.body;
    if (!UserPoolId) {
      throw new InvalidParameterError("UserPoolId is required.");
    }
    const pem = (
      ctx.keys.publicKey.export({ format: "pem", type: "spki" }) as string
    ).trim();
    res.json({ Certificate: pem });
  };
}

export function adminUpdateDeviceStatusStubHandler(_ctx: AppContext) {
  return (_req: Request, res: Response): void => {
    res.json({});
  };
}
