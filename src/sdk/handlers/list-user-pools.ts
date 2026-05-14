import { Request, Response } from "express";
import { AppContext } from "../../index";

export function listUserPoolsHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { MaxResults, NextToken } = req.body;
    const all = ctx.userPoolStore.listPools();
    const start = NextToken ? parseInt(NextToken, 10) || 0 : 0;
    const pageSize = MaxResults || 60;
    const page = all.slice(start, start + pageSize);
    const next = start + pageSize < all.length ? String(start + pageSize) : undefined;

    res.json({
      UserPools: page.map((p) => ({
        Id: p.id,
        Name: p.name,
        Status: "Enabled",
        LambdaConfig: {},
        CreationDate: p.createdAt,
        LastModifiedDate: p.updatedAt,
      })),
      NextToken: next,
    });
  };
}
