import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError } from "../../errors";
import { DataStore } from "../../data/store";
import { ResourceTag } from "../../types";

let store: DataStore<ResourceTag> | undefined;
function getStore(ctx: AppContext): DataStore<ResourceTag> {
  if (!store) {
    store = new DataStore<ResourceTag>(ctx.config.dataDir, "tags.json");
  }
  return store;
}

export function tagResourceHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { ResourceArn, Tags } = req.body;
    if (!ResourceArn || !Tags) {
      throw new InvalidParameterError(
        "ResourceArn and Tags are required."
      );
    }
    const existing = getStore(ctx).get(ResourceArn);
    getStore(ctx).set(ResourceArn, {
      resourceArn: ResourceArn,
      tags: { ...(existing?.tags ?? {}), ...Tags },
    });
    res.json({});
  };
}

export function untagResourceHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { ResourceArn, TagKeys } = req.body;
    if (!ResourceArn || !TagKeys) {
      throw new InvalidParameterError(
        "ResourceArn and TagKeys are required."
      );
    }
    const existing = getStore(ctx).get(ResourceArn);
    if (!existing) {
      res.json({});
      return;
    }
    const next: Record<string, string> = { ...existing.tags };
    for (const k of TagKeys) delete next[k];
    getStore(ctx).set(ResourceArn, {
      resourceArn: ResourceArn,
      tags: next,
    });
    res.json({});
  };
}

export function listTagsForResourceHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { ResourceArn } = req.body;
    if (!ResourceArn) {
      throw new InvalidParameterError("ResourceArn is required.");
    }
    const existing = getStore(ctx).get(ResourceArn);
    res.json({ Tags: existing?.tags ?? {} });
  };
}
