import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError, ResourceNotFoundError } from "../../errors";
import { DataStore } from "../../data/store";
import { Device } from "../../types";
import { resolveUserFromAccessToken } from "../access-token";

let store: DataStore<Device> | undefined;
function getStore(ctx: AppContext): DataStore<Device> {
  if (!store) {
    store = new DataStore<Device>(ctx.config.dataDir, "devices.json");
  }
  return store;
}
const key = (poolId: string, username: string, deviceKey: string) =>
  `${poolId}:${username}:${deviceKey}`;

function attributesArrayToRecord(
  attrs: { Name: string; Value: string }[] | undefined
) {
  const out: Record<string, string> = {};
  for (const a of attrs ?? []) out[a.Name] = a.Value;
  return out;
}
function recordToAttributesArray(rec: Record<string, string>) {
  return Object.entries(rec).map(([Name, Value]) => ({ Name, Value }));
}

function toResponse(d: Device) {
  return {
    DeviceKey: d.deviceKey,
    DeviceAttributes: recordToAttributesArray(d.deviceAttributes),
    DeviceCreateDate: d.deviceCreateDate,
    DeviceLastModifiedDate: d.deviceLastModifiedDate,
    DeviceLastAuthenticatedDate: d.deviceLastAuthenticatedDate,
  };
}

export function confirmDeviceHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { AccessToken, DeviceKey, DeviceName, DeviceSecretVerifierConfig } = req.body;
    if (!AccessToken || !DeviceKey) {
      throw new InvalidParameterError(
        "AccessToken and DeviceKey are required."
      );
    }
    const { user } = resolveUserFromAccessToken(ctx, AccessToken);
    const now = ctx.clock.now().toISOString();
    const device: Device = {
      deviceKey: DeviceKey,
      username: user.username,
      userPoolId: user.userPoolId,
      deviceAttributes: { device_name: DeviceName ?? "", ...DeviceSecretVerifierConfig },
      deviceCreateDate: now,
      deviceLastModifiedDate: now,
      deviceRememberedStatus: "remembered",
    };
    getStore(ctx).set(
      key(user.userPoolId, user.username, DeviceKey),
      device
    );
    res.json({ UserConfirmationNecessary: false });
  };
}

export function forgetDeviceHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { AccessToken, DeviceKey } = req.body;
    if (!AccessToken || !DeviceKey) {
      throw new InvalidParameterError(
        "AccessToken and DeviceKey are required."
      );
    }
    const { user } = resolveUserFromAccessToken(ctx, AccessToken);
    getStore(ctx).delete(key(user.userPoolId, user.username, DeviceKey));
    res.json({});
  };
}

export function getDeviceHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { AccessToken, DeviceKey } = req.body;
    if (!AccessToken || !DeviceKey) {
      throw new InvalidParameterError(
        "AccessToken and DeviceKey are required."
      );
    }
    const { user } = resolveUserFromAccessToken(ctx, AccessToken);
    const d = getStore(ctx).get(key(user.userPoolId, user.username, DeviceKey));
    if (!d) throw new ResourceNotFoundError(`Device ${DeviceKey} not found.`);
    res.json({ Device: toResponse(d) });
  };
}

export function listDevicesHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { AccessToken, Limit } = req.body;
    if (!AccessToken) {
      throw new InvalidParameterError("AccessToken is required.");
    }
    const { user } = resolveUserFromAccessToken(ctx, AccessToken);
    let devices = getStore(ctx)
      .values()
      .filter(
        (d) => d.userPoolId === user.userPoolId && d.username === user.username
      );
    if (Limit) devices = devices.slice(0, Limit);
    res.json({ Devices: devices.map(toResponse) });
  };
}

export function updateDeviceStatusHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { AccessToken, DeviceKey, DeviceRememberedStatus } = req.body;
    if (!AccessToken || !DeviceKey) {
      throw new InvalidParameterError(
        "AccessToken and DeviceKey are required."
      );
    }
    const { user } = resolveUserFromAccessToken(ctx, AccessToken);
    const d = getStore(ctx).get(key(user.userPoolId, user.username, DeviceKey));
    if (!d) throw new ResourceNotFoundError(`Device ${DeviceKey} not found.`);
    getStore(ctx).set(key(user.userPoolId, user.username, DeviceKey), {
      ...d,
      deviceRememberedStatus: DeviceRememberedStatus ?? "remembered",
      deviceLastModifiedDate: ctx.clock.now().toISOString(),
    });
    res.json({});
  };
}

// Admin variants take UserPoolId + Username + DeviceKey instead of AccessToken
export function adminForgetDeviceHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, Username, DeviceKey } = req.body;
    if (!UserPoolId || !Username || !DeviceKey) {
      throw new InvalidParameterError(
        "UserPoolId, Username, and DeviceKey are required."
      );
    }
    const user = ctx.userPoolStore.getUserByUsername(UserPoolId, Username);
    if (!user) throw new ResourceNotFoundError(`User not found.`);
    getStore(ctx).delete(key(UserPoolId, user.username, DeviceKey));
    res.json({});
  };
}

export function adminGetDeviceHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, Username, DeviceKey } = req.body;
    if (!UserPoolId || !Username || !DeviceKey) {
      throw new InvalidParameterError(
        "UserPoolId, Username, and DeviceKey are required."
      );
    }
    const user = ctx.userPoolStore.getUserByUsername(UserPoolId, Username);
    if (!user) throw new ResourceNotFoundError(`User not found.`);
    const d = getStore(ctx).get(key(UserPoolId, user.username, DeviceKey));
    if (!d) throw new ResourceNotFoundError(`Device ${DeviceKey} not found.`);
    res.json({ Device: toResponse(d) });
  };
}

export function adminListDevicesHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, Username, Limit } = req.body;
    if (!UserPoolId || !Username) {
      throw new InvalidParameterError(
        "UserPoolId and Username are required."
      );
    }
    const user = ctx.userPoolStore.getUserByUsername(UserPoolId, Username);
    if (!user) throw new ResourceNotFoundError(`User not found.`);
    let devices = getStore(ctx)
      .values()
      .filter((d) => d.userPoolId === UserPoolId && d.username === user.username);
    if (Limit) devices = devices.slice(0, Limit);
    res.json({ Devices: devices.map(toResponse) });
  };
}

export function adminUpdateDeviceStatusHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, Username, DeviceKey, DeviceRememberedStatus } = req.body;
    if (!UserPoolId || !Username || !DeviceKey) {
      throw new InvalidParameterError(
        "UserPoolId, Username, and DeviceKey are required."
      );
    }
    const user = ctx.userPoolStore.getUserByUsername(UserPoolId, Username);
    if (!user) throw new ResourceNotFoundError(`User not found.`);
    const d = getStore(ctx).get(key(UserPoolId, user.username, DeviceKey));
    if (!d) throw new ResourceNotFoundError(`Device ${DeviceKey} not found.`);
    getStore(ctx).set(key(UserPoolId, user.username, DeviceKey), {
      ...d,
      deviceRememberedStatus: DeviceRememberedStatus ?? "remembered",
      deviceLastModifiedDate: ctx.clock.now().toISOString(),
    });
    res.json({});
  };
}

// Unused helper just to satisfy `attributesArrayToRecord` import linter
export { attributesArrayToRecord };
