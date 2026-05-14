import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  InvalidParameterError,
  ResourceNotFoundError,
} from "../../errors";
import { DataStore } from "../../data/store";
import { IdentityProvider } from "../../types";

let store: DataStore<IdentityProvider> | undefined;
function getStore(ctx: AppContext): DataStore<IdentityProvider> {
  if (!store) {
    store = new DataStore<IdentityProvider>(
      ctx.config.dataDir,
      "identity-providers.json"
    );
  }
  return store;
}
const key = (poolId: string, name: string) => `${poolId}:${name}`;

export function createIdentityProviderHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const {
      UserPoolId,
      ProviderName,
      ProviderType,
      ProviderDetails,
      AttributeMapping,
      IdpIdentifiers,
    } = req.body;
    if (!UserPoolId || !ProviderName || !ProviderType) {
      throw new InvalidParameterError(
        "UserPoolId, ProviderName, and ProviderType are required."
      );
    }
    const now = ctx.clock.now().toISOString();
    const idp: IdentityProvider = {
      providerName: ProviderName,
      providerType: ProviderType,
      userPoolId: UserPoolId,
      providerDetails: ProviderDetails ?? {},
      attributeMapping: AttributeMapping,
      idpIdentifiers: IdpIdentifiers,
      createdAt: now,
      updatedAt: now,
    };
    getStore(ctx).set(key(UserPoolId, ProviderName), idp);
    res.json({
      IdentityProvider: {
        ProviderName: idp.providerName,
        ProviderType: idp.providerType,
        UserPoolId: idp.userPoolId,
        ProviderDetails: idp.providerDetails,
        AttributeMapping: idp.attributeMapping,
        IdpIdentifiers: idp.idpIdentifiers,
        CreationDate: idp.createdAt,
        LastModifiedDate: idp.updatedAt,
      },
    });
  };
}

export function describeIdentityProviderHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, ProviderName } = req.body;
    if (!UserPoolId || !ProviderName) {
      throw new InvalidParameterError(
        "UserPoolId and ProviderName are required."
      );
    }
    const idp = getStore(ctx).get(key(UserPoolId, ProviderName));
    if (!idp) {
      throw new ResourceNotFoundError(
        `Identity provider ${ProviderName} not found.`
      );
    }
    res.json({
      IdentityProvider: {
        ProviderName: idp.providerName,
        ProviderType: idp.providerType,
        UserPoolId: idp.userPoolId,
        ProviderDetails: idp.providerDetails,
        AttributeMapping: idp.attributeMapping,
        IdpIdentifiers: idp.idpIdentifiers,
        CreationDate: idp.createdAt,
        LastModifiedDate: idp.updatedAt,
      },
    });
  };
}

export function listIdentityProvidersHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId } = req.body;
    if (!UserPoolId) {
      throw new InvalidParameterError("UserPoolId is required.");
    }
    const items = getStore(ctx)
      .values()
      .filter((i) => i.userPoolId === UserPoolId);
    res.json({
      Providers: items.map((i) => ({
        ProviderName: i.providerName,
        ProviderType: i.providerType,
        LastModifiedDate: i.updatedAt,
        CreationDate: i.createdAt,
      })),
    });
  };
}

export function updateIdentityProviderHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const {
      UserPoolId,
      ProviderName,
      ProviderDetails,
      AttributeMapping,
      IdpIdentifiers,
    } = req.body;
    if (!UserPoolId || !ProviderName) {
      throw new InvalidParameterError(
        "UserPoolId and ProviderName are required."
      );
    }
    const existing = getStore(ctx).get(key(UserPoolId, ProviderName));
    if (!existing) {
      throw new ResourceNotFoundError(
        `Identity provider ${ProviderName} not found.`
      );
    }
    const updated = {
      ...existing,
      providerDetails: ProviderDetails ?? existing.providerDetails,
      attributeMapping: AttributeMapping ?? existing.attributeMapping,
      idpIdentifiers: IdpIdentifiers ?? existing.idpIdentifiers,
      updatedAt: ctx.clock.now().toISOString(),
    };
    getStore(ctx).set(key(UserPoolId, ProviderName), updated);
    res.json({
      IdentityProvider: {
        ProviderName: updated.providerName,
        ProviderType: updated.providerType,
        UserPoolId: updated.userPoolId,
        ProviderDetails: updated.providerDetails,
        AttributeMapping: updated.attributeMapping,
        IdpIdentifiers: updated.idpIdentifiers,
        CreationDate: updated.createdAt,
        LastModifiedDate: updated.updatedAt,
      },
    });
  };
}

export function deleteIdentityProviderHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, ProviderName } = req.body;
    if (!UserPoolId || !ProviderName) {
      throw new InvalidParameterError(
        "UserPoolId and ProviderName are required."
      );
    }
    getStore(ctx).delete(key(UserPoolId, ProviderName));
    res.json({});
  };
}

export function getIdentityProviderByIdentifierHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, IdpIdentifier } = req.body;
    if (!UserPoolId || !IdpIdentifier) {
      throw new InvalidParameterError(
        "UserPoolId and IdpIdentifier are required."
      );
    }
    const idp = getStore(ctx)
      .values()
      .find(
        (i) =>
          i.userPoolId === UserPoolId &&
          (i.idpIdentifiers ?? []).includes(IdpIdentifier)
      );
    if (!idp) {
      throw new ResourceNotFoundError(
        `Identity provider with identifier ${IdpIdentifier} not found.`
      );
    }
    res.json({
      IdentityProvider: {
        ProviderName: idp.providerName,
        ProviderType: idp.providerType,
        UserPoolId: idp.userPoolId,
        ProviderDetails: idp.providerDetails,
        AttributeMapping: idp.attributeMapping,
        IdpIdentifiers: idp.idpIdentifiers,
        CreationDate: idp.createdAt,
        LastModifiedDate: idp.updatedAt,
      },
    });
  };
}
