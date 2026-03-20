import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  resourceNotFoundError,
  usernameExistsError,
  invalidParameterError,
} from "../errors";

export function signUpHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { ClientId, Password, UserAttributes } = req.body;

    if (!ClientId || !Password) {
      invalidParameterError(res, "ClientId and Password are required.");
      return;
    }

    const client = ctx.clientStore.getClient(ClientId);
    if (!client) {
      resourceNotFoundError(res, `Client ${ClientId} not found.`);
      return;
    }

    const poolId = client.userPoolId;

    // Extract email from attributes
    const attrs: Record<string, string> = {};
    let email = "";
    if (UserAttributes && Array.isArray(UserAttributes)) {
      for (const attr of UserAttributes) {
        attrs[attr.Name] = attr.Value;
        if (attr.Name === "email") {
          email = attr.Value;
        }
      }
    }

    if (!email) {
      invalidParameterError(res, "An email attribute is required.");
      return;
    }

    // Check email not already taken
    const existing = ctx.userPoolStore.getUserByEmail(poolId, email);
    if (existing) {
      usernameExistsError(res, "An account with the given email already exists.");
      return;
    }

    const pool = ctx.userPoolStore.getPool(poolId);
    const username = pool?.usernameAttributes?.includes("email")
      ? email.toLowerCase()
      : ctx.userPoolStore.generateUsername();
    const confirmationCode = ctx.userPoolStore.generateConfirmationCode();

    console.log(
      `[SignUp] User ${email} created with confirmation code: ${confirmationCode}`
    );

    ctx.userPoolStore.createUser({
      username,
      email: email.toLowerCase(),
      password: Password,
      attributes: {
        sub: username,
        email: email.toLowerCase(),
        email_verified: "false",
        ...attrs,
      },
      groups: [],
      status: "UNCONFIRMED",
      enabled: true,
      confirmationCode,
      userPoolId: poolId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.json({
      UserConfirmed: false,
      UserSub: username,
    });
  };
}
