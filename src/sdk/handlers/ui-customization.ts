import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError } from "../../errors";
import { DataStore } from "../../data/store";
import { UICustomization } from "../../types";

let store: DataStore<UICustomization> | undefined;
function getStore(ctx: AppContext): DataStore<UICustomization> {
  if (!store) {
    store = new DataStore<UICustomization>(
      ctx.config.dataDir,
      "ui-customizations.json"
    );
  }
  return store;
}
const key = (poolId: string, clientId: string) => `${poolId}:${clientId ?? "ALL"}`;

export function getUICustomizationHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, ClientId } = req.body;
    if (!UserPoolId) {
      throw new InvalidParameterError("UserPoolId is required.");
    }
    const ui = getStore(ctx).get(key(UserPoolId, ClientId ?? "ALL"));
    res.json({
      UICustomization: ui
        ? {
            UserPoolId: ui.userPoolId,
            ClientId: ui.clientId,
            ImageUrl: ui.imageUrl,
            CSS: ui.css,
            CSSVersion: ui.cssVersion,
            CreationDate: ui.createdAt,
            LastModifiedDate: ui.lastModifiedAt,
          }
        : { UserPoolId, ClientId: ClientId ?? "ALL" },
    });
  };
}

export function setUICustomizationHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, ClientId, CSS, ImageFile } = req.body;
    if (!UserPoolId) {
      throw new InvalidParameterError("UserPoolId is required.");
    }
    const now = ctx.clock.now().toISOString();
    const ui: UICustomization = {
      userPoolId: UserPoolId,
      clientId: ClientId ?? "ALL",
      css: CSS,
      cssVersion: "1",
      imageUrl: ImageFile ? `data:image/png;base64,${ImageFile}` : undefined,
      createdAt: now,
      lastModifiedAt: now,
    };
    getStore(ctx).set(key(UserPoolId, ui.clientId), ui);
    res.json({
      UICustomization: {
        UserPoolId: ui.userPoolId,
        ClientId: ui.clientId,
        CSS: ui.css,
        CSSVersion: ui.cssVersion,
        ImageUrl: ui.imageUrl,
        CreationDate: ui.createdAt,
        LastModifiedDate: ui.lastModifiedAt,
      },
    });
  };
}
