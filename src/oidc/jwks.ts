import { Request, Response } from "express";
import { AppContext } from "../index";

export function createJwksHandler(ctx: AppContext) {
  return (_req: Request, res: Response): void => {
    res.json({ keys: [ctx.keys.jwk] });
  };
}
