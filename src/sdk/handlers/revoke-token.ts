import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError } from "../../errors";

export function revokeTokenHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { Token } = req.body;
    if (!Token) {
      throw new InvalidParameterError("Token is required.");
    }

    const entry = ctx.tokenStore.getRefreshToken(Token);
    if (entry) {
      ctx.tokenStore.revokeRefreshToken(Token);
      const user = ctx.userPoolStore.getUser(entry.userPoolId, entry.userId);
      if (user) {
        ctx.userPoolStore.updateUser({
          ...user,
          refreshTokens: user.refreshTokens.filter((t) => t !== Token),
          updatedAt: ctx.clock.now().toISOString(),
        });
      }
    }

    res.json({});
  };
}
