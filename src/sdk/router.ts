import express, { Request, Response, NextFunction, Router } from "express";
import { AppContext } from "../index";
import { signUpHandler } from "./handlers/sign-up";
import { confirmSignUpHandler } from "./handlers/confirm-sign-up";
import { resendConfirmationCodeHandler } from "./handlers/resend-confirmation-code";
import { initiateAuthHandler } from "./handlers/initiate-auth";
import { adminGetUserHandler } from "./handlers/admin-get-user";
import { adminUpdateUserAttributesHandler } from "./handlers/admin-update-user-attributes";
import { adminDeleteUserAttributesHandler } from "./handlers/admin-delete-user-attributes";
import { adminDeleteUserHandler } from "./handlers/admin-delete-user";
import { listUsersHandler } from "./handlers/list-users";
import { describeUserPoolHandler } from "./handlers/describe-user-pool";
import { createUserPoolHandler } from "./handlers/create-user-pool";
import { createUserPoolClientHandler } from "./handlers/create-user-pool-client";

const TARGET_PREFIX = "AWSCognitoIdentityProviderService.";

export function createSdkRouter(ctx: AppContext): Router {
  const router = Router();

  const handlers: Record<string, (req: Request, res: Response) => void> = {
    SignUp: signUpHandler(ctx),
    ConfirmSignUp: confirmSignUpHandler(ctx),
    ResendConfirmationCode: resendConfirmationCodeHandler(ctx),
    InitiateAuth: initiateAuthHandler(ctx),
    AdminGetUser: adminGetUserHandler(ctx),
    AdminUpdateUserAttributes: adminUpdateUserAttributesHandler(ctx),
    AdminDeleteUserAttributes: adminDeleteUserAttributesHandler(ctx),
    AdminDeleteUser: adminDeleteUserHandler(ctx),
    ListUsers: listUsersHandler(ctx),
    DescribeUserPool: describeUserPoolHandler(ctx),
    CreateUserPool: createUserPoolHandler(ctx),
    CreateUserPoolClient: createUserPoolClientHandler(ctx),
  };

  router.post(
    "/",
    express.json({ type: "application/x-amz-json-1.1" }),
    (req: Request, res: Response, next: NextFunction) => {
      const target = req.headers["x-amz-target"];
      if (typeof target !== "string" || !target.startsWith(TARGET_PREFIX)) {
        // Not an SDK request; pass through to next route handler (e.g. OIDC)
        next();
        return;
      }

      const operation = target.slice(TARGET_PREFIX.length);
      const handler = handlers[operation];

      if (!handler) {
        res.status(400).json({ __type: "InvalidAction" });
        return;
      }

      handler(req, res);
    }
  );

  return router;
}
