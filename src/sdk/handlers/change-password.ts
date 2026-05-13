import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError, NotAuthorizedError } from "../../errors";
import { resolveUserFromAccessToken } from "../access-token";
import { validatePassword } from "../../util/password";

export function changePasswordHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { AccessToken, PreviousPassword, ProposedPassword } = req.body;
    if (!AccessToken || !PreviousPassword || !ProposedPassword) {
      throw new InvalidParameterError(
        "AccessToken, PreviousPassword, and ProposedPassword are required."
      );
    }

    const { user, pool } = resolveUserFromAccessToken(ctx, AccessToken);

    if (user.password !== PreviousPassword) {
      throw new NotAuthorizedError("Incorrect username or password.");
    }

    validatePassword(ProposedPassword, pool.passwordPolicy);

    ctx.userPoolStore.updateUser({
      ...user,
      password: ProposedPassword,
      updatedAt: ctx.clock.now().toISOString(),
    });

    res.json({});
  };
}
