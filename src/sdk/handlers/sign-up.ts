import { Request, Response } from "express";
import { AppContext } from "../../index";
import {
  InvalidParameterError,
  ResourceNotFoundError,
  UsernameExistsError,
} from "../../errors";
import { attributesArrayToRecord } from "../../util/attributes";
import { validateAttributesForSignUp } from "../../util/attributes";
import { validatePassword } from "../../util/password";
import { triggerEvent } from "../../triggers";

export function signUpHandler(ctx: AppContext) {
  return async (req: Request, res: Response): Promise<void> => {
    const {
      ClientId,
      Password,
      UserAttributes,
      Username,
      ValidationData,
      ClientMetadata,
    } = req.body;

    if (!ClientId || !Password || !Username) {
      throw new InvalidParameterError(
        "ClientId, Username, and Password are required."
      );
    }

    const client = ctx.clientStore.getClient(ClientId);
    if (!client) {
      throw new ResourceNotFoundError(`Client ${ClientId} not found.`);
    }
    const poolId = client.userPoolId;
    const pool = ctx.userPoolStore.getPool(poolId);
    if (!pool) {
      throw new ResourceNotFoundError(`User pool ${poolId} does not exist.`);
    }

    const attrs = attributesArrayToRecord(UserAttributes);
    const usesEmailUsername = pool.usernameAttributes.includes("email");
    if (usesEmailUsername) {
      attrs.email = attrs.email ?? Username;
    }
    const email = attrs.email ?? "";
    if (usesEmailUsername && !email.includes("@")) {
      throw new InvalidParameterError("Username should be an email.");
    }

    validateAttributesForSignUp(pool, attrs);
    validatePassword(Password, pool.passwordPolicy);

    if (email && ctx.userPoolStore.getUserByEmail(poolId, email)) {
      throw new UsernameExistsError(
        "An account with the given email already exists."
      );
    }

    const sub = ctx.userPoolStore.generateUsername();
    const internalUsername = usesEmailUsername ? sub : Username;

    if (ctx.userPoolStore.getUser(poolId, internalUsername)) {
      throw new UsernameExistsError();
    }

    let status: "UNCONFIRMED" | "CONFIRMED" = "UNCONFIRMED";
    const attributesAfter: Record<string, string> = {
      ...attrs,
      sub,
      email_verified: "false",
    };

    // PreSignUp trigger — passes through ValidationData (#351)
    if (ctx.triggers.enabled(poolId, "preSignUp")) {
      const event = triggerEvent({
        triggerSource: "PreSignUp_SignUp",
        userPoolId: poolId,
        username: internalUsername,
        region: pool.region,
        clientId: ClientId,
        userAttributes: attrs,
        request: {
          validationData: attributesArrayToRecord(ValidationData), // #351
          clientMetadata: ClientMetadata,
        },
      });
      const result = (await ctx.triggers.fire(pool, "preSignUp", event)) as
        | {
            response?: {
              autoConfirmUser?: boolean;
              autoVerifyEmail?: boolean;
              autoVerifyPhone?: boolean;
            };
          }
        | null;
      const r = result?.response ?? {};
      if (r.autoConfirmUser) status = "CONFIRMED";
      if (r.autoVerifyEmail) attributesAfter.email_verified = "true";
      if (r.autoVerifyPhone && attributesAfter.phone_number) {
        attributesAfter.phone_number_verified = "true";
      }
    }

    const confirmationCode = ctx.userPoolStore.generateConfirmationCode();
    ctx.logger.info({ email, confirmationCode }, "SignUp: user created");

    const now = ctx.clock.now().toISOString();
    ctx.userPoolStore.createUser({
      username: internalUsername,
      email: email.toLowerCase(),
      password: Password,
      attributes: { ...attributesAfter, email: email.toLowerCase() },
      groups: [],
      status,
      enabled: true,
      confirmationCode: status === "UNCONFIRMED" ? confirmationCode : undefined,
      refreshTokens: [],
      userPoolId: poolId,
      createdAt: now,
      updatedAt: now,
    });

    if (status === "CONFIRMED" && ctx.triggers.enabled(poolId, "postConfirmation")) {
      const event = triggerEvent({
        triggerSource: "PostConfirmation_ConfirmSignUp",
        userPoolId: poolId,
        username: internalUsername,
        region: pool.region,
        clientId: ClientId,
        userAttributes: { ...attributesAfter, "cognito:user_status": status },
        request: { clientMetadata: ClientMetadata },
      });
      try {
        await ctx.triggers.fire(pool, "postConfirmation", event);
      } catch (err) {
        ctx.logger.warn({ err }, "PostConfirmation trigger failed");
      }
    }

    res.json({
      UserConfirmed: status === "CONFIRMED",
      UserSub: sub,
      CodeDeliveryDetails:
        status === "UNCONFIRMED"
          ? {
              DeliveryMedium: "EMAIL",
              AttributeName: "email",
              Destination: email,
            }
          : undefined,
    });
  };
}
