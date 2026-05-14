import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError, ResourceNotFoundError } from "../../errors";
import { DataStore } from "../../data/store";
import { ResourceServer } from "../../types";

let store: DataStore<ResourceServer> | undefined;
function getStore(ctx: AppContext): DataStore<ResourceServer> {
  if (!store) {
    store = new DataStore<ResourceServer>(
      ctx.config.dataDir,
      "resource-servers.json"
    );
  }
  return store;
}
const key = (poolId: string, id: string) => `${poolId}:${id}`;

function toResponse(rs: ResourceServer) {
  return {
    ResourceServer: {
      UserPoolId: rs.userPoolId,
      Identifier: rs.identifier,
      Name: rs.name,
      Scopes: rs.scopes.map((s) => ({
        ScopeName: s.scopeName,
        ScopeDescription: s.scopeDescription,
      })),
    },
  };
}

export function createResourceServerHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, Identifier, Name, Scopes } = req.body;
    if (!UserPoolId || !Identifier || !Name) {
      throw new InvalidParameterError(
        "UserPoolId, Identifier, and Name are required."
      );
    }
    const rs: ResourceServer = {
      userPoolId: UserPoolId,
      identifier: Identifier,
      name: Name,
      scopes: (Scopes ?? []).map(
        (s: { ScopeName: string; ScopeDescription: string }) => ({
          scopeName: s.ScopeName,
          scopeDescription: s.ScopeDescription,
        })
      ),
    };
    getStore(ctx).set(key(UserPoolId, Identifier), rs);
    res.json(toResponse(rs));
  };
}

export function describeResourceServerHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, Identifier } = req.body;
    if (!UserPoolId || !Identifier) {
      throw new InvalidParameterError(
        "UserPoolId and Identifier are required."
      );
    }
    const rs = getStore(ctx).get(key(UserPoolId, Identifier));
    if (!rs) throw new ResourceNotFoundError(`Resource server ${Identifier} not found.`);
    res.json(toResponse(rs));
  };
}

export function listResourceServersHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, MaxResults, NextToken } = req.body;
    if (!UserPoolId) {
      throw new InvalidParameterError("UserPoolId is required.");
    }
    const all = getStore(ctx)
      .values()
      .filter((r) => r.userPoolId === UserPoolId);
    const start = NextToken ? parseInt(NextToken, 10) || 0 : 0;
    const pageSize = MaxResults || 60;
    const page = all.slice(start, start + pageSize);
    const next = start + pageSize < all.length ? String(start + pageSize) : undefined;
    res.json({
      ResourceServers: page.map((rs) => ({
        UserPoolId: rs.userPoolId,
        Identifier: rs.identifier,
        Name: rs.name,
        Scopes: rs.scopes.map((s) => ({
          ScopeName: s.scopeName,
          ScopeDescription: s.scopeDescription,
        })),
      })),
      NextToken: next,
    });
  };
}

export function updateResourceServerHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, Identifier, Name, Scopes } = req.body;
    if (!UserPoolId || !Identifier) {
      throw new InvalidParameterError(
        "UserPoolId and Identifier are required."
      );
    }
    const existing = getStore(ctx).get(key(UserPoolId, Identifier));
    if (!existing)
      throw new ResourceNotFoundError(`Resource server ${Identifier} not found.`);
    const updated = {
      ...existing,
      name: Name ?? existing.name,
      scopes: Scopes
        ? Scopes.map((s: { ScopeName: string; ScopeDescription: string }) => ({
            scopeName: s.ScopeName,
            scopeDescription: s.ScopeDescription,
          }))
        : existing.scopes,
    };
    getStore(ctx).set(key(UserPoolId, Identifier), updated);
    res.json(toResponse(updated));
  };
}

export function deleteResourceServerHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, Identifier } = req.body;
    if (!UserPoolId || !Identifier) {
      throw new InvalidParameterError(
        "UserPoolId and Identifier are required."
      );
    }
    getStore(ctx).delete(key(UserPoolId, Identifier));
    res.json({});
  };
}
