import { Request, Response } from "express";
import { AppContext } from "../index";

export function createRevokeHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { token } = req.body as { token?: string };

    if (token) {
      ctx.tokenStore.revokeRefreshToken(token);
      console.log("Token revoked");
    } else {
      console.log("Token revocation requested with no token");
    }

    res.status(200).json({});
  };
}
