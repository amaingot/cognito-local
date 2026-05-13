import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { AppContext } from "../../index";
import {
  InvalidParameterError,
  ResourceNotFoundError,
  UsernameExistsError,
} from "../../errors";
import { attributesArrayToRecord } from "../../util/attributes";
import { CognitoUser, UserStatus } from "../../types";

function generateTemporaryPassword(): string {
  // 12 chars: upper + lower + digit + symbol (meets default policy)
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*";
  const all = upper + lower + digits + symbols;
  let out = "";
  out += upper[Math.floor(Math.random() * upper.length)];
  out += lower[Math.floor(Math.random() * lower.length)];
  out += digits[Math.floor(Math.random() * digits.length)];
  out += symbols[Math.floor(Math.random() * symbols.length)];
  for (let i = 0; i < 8; i++) {
    out += all[Math.floor(Math.random() * all.length)];
  }
  return out;
}

export function adminCreateUserHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const {
      UserPoolId,
      Username,
      UserAttributes,
      TemporaryPassword,
      MessageAction,
    } = req.body;

    if (!UserPoolId || !Username) {
      throw new InvalidParameterError(
        "UserPoolId and Username are required."
      );
    }

    const pool = ctx.userPoolStore.getPool(UserPoolId);
    if (!pool) {
      throw new ResourceNotFoundError(
        `User pool ${UserPoolId} does not exist.`
      );
    }

    const attrs = attributesArrayToRecord(UserAttributes);
    const usesEmailUsername = pool.usernameAttributes.includes("email");
    const email = attrs.email ?? (usesEmailUsername ? Username : "");
    const sub = uuidv4();
    const internalUsername = usesEmailUsername ? sub : Username;

    if (ctx.userPoolStore.getUser(UserPoolId, internalUsername)) {
      throw new UsernameExistsError();
    }
    if (email && ctx.userPoolStore.getUserByEmail(UserPoolId, email)) {
      throw new UsernameExistsError(
        "An account with the given email already exists."
      );
    }

    const tempPassword = TemporaryPassword ?? generateTemporaryPassword();
    const status: UserStatus =
      MessageAction === "SUPPRESS" ? "FORCE_CHANGE_PASSWORD" : "FORCE_CHANGE_PASSWORD";

    const now = ctx.clock.now();
    const user: CognitoUser = {
      username: internalUsername,
      email: email.toLowerCase(),
      password: tempPassword,
      attributes: {
        sub,
        ...attrs,
        email: email.toLowerCase(),
        email_verified:
          attrs.email_verified ?? (usesEmailUsername ? "true" : "false"),
      },
      groups: [],
      status,
      enabled: true,
      refreshTokens: [],
      userPoolId: UserPoolId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    ctx.userPoolStore.createUser(user);

    if (MessageAction !== "SUPPRESS") {
      ctx.logger.info(
        { email, tempPassword },
        "AdminCreateUser: temporary password issued"
      );
    }

    res.json({
      User: {
        Username: user.username,
        Attributes: Object.entries(user.attributes).map(([Name, Value]) => ({
          Name,
          Value,
        })),
        UserCreateDate: user.createdAt,
        UserLastModifiedDate: user.updatedAt,
        Enabled: user.enabled,
        UserStatus: user.status,
      },
    });
  };
}
