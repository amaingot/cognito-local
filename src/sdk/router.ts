import express, { Request, Response, NextFunction, Router } from "express";
import { AppContext } from "../index";
import { CognitoError, UnsupportedError } from "../errors";
import { cognitoJsonReplacer } from "../util/json";

// Existing handlers
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

// Phase 4 — Quick-win SDK ops
import { getUserHandler } from "./handlers/get-user";
import { updateUserAttributesHandler } from "./handlers/update-user-attributes";
import { changePasswordHandler } from "./handlers/change-password";
import { forgotPasswordHandler } from "./handlers/forgot-password";
import { confirmForgotPasswordHandler } from "./handlers/confirm-forgot-password";
import { globalSignOutHandler } from "./handlers/global-sign-out";
import { deleteUserHandler } from "./handlers/delete-user";
import { deleteUserAttributesHandler } from "./handlers/delete-user-attributes";
import { verifyUserAttributeHandler } from "./handlers/verify-user-attribute";
import { getUserAttributeVerificationCodeHandler } from "./handlers/get-user-attribute-verification-code";
import { revokeTokenHandler } from "./handlers/revoke-token";

// Phase 5 — Admin SDK ops
import { adminCreateUserHandler } from "./handlers/admin-create-user";
import { adminInitiateAuthHandler } from "./handlers/admin-initiate-auth";
import { adminConfirmSignUpHandler } from "./handlers/admin-confirm-sign-up";
import { adminSetUserPasswordHandler } from "./handlers/admin-set-user-password";
import { adminDisableUserHandler } from "./handlers/admin-disable-user";
import { adminEnableUserHandler } from "./handlers/admin-enable-user";
import { adminResetUserPasswordHandler } from "./handlers/admin-reset-user-password";
import { adminUserGlobalSignOutHandler } from "./handlers/admin-user-global-sign-out";

// Phase 6 — Pool / client management
import { listUserPoolsHandler } from "./handlers/list-user-pools";
import { updateUserPoolHandler } from "./handlers/update-user-pool";
import { deleteUserPoolHandler } from "./handlers/delete-user-pool";
import { describeUserPoolClientHandler } from "./handlers/describe-user-pool-client";
import { listUserPoolClientsHandler } from "./handlers/list-user-pool-clients";
import { updateUserPoolClientHandler } from "./handlers/update-user-pool-client";
import { deleteUserPoolClientHandler } from "./handlers/delete-user-pool-client";

// Phase 8 — Custom attributes
import { addCustomAttributesHandler } from "./handlers/add-custom-attributes";

// Phase 9 — RespondToAuthChallenge
import {
  respondToAuthChallengeHandler,
  adminRespondToAuthChallengeHandler,
} from "./handlers/respond-to-auth-challenge";

// Phase 11 — MFA / TOTP
import { associateSoftwareTokenHandler } from "./handlers/associate-software-token";
import { verifySoftwareTokenHandler } from "./handlers/verify-software-token";
import {
  setUserMFAPreferenceHandler,
  adminSetUserMFAPreferenceHandler,
} from "./handlers/set-user-mfa-preference";
import {
  getUserPoolMfaConfigHandler,
  setUserPoolMfaConfigHandler,
} from "./handlers/get-user-pool-mfa-config";

// Phase 13 — Niche SDK ops
import {
  createIdentityProviderHandler,
  describeIdentityProviderHandler,
  listIdentityProvidersHandler,
  updateIdentityProviderHandler,
  deleteIdentityProviderHandler,
  getIdentityProviderByIdentifierHandler,
} from "./handlers/identity-providers";
import {
  createResourceServerHandler,
  describeResourceServerHandler,
  listResourceServersHandler,
  updateResourceServerHandler,
  deleteResourceServerHandler,
} from "./handlers/resource-servers";
import {
  tagResourceHandler,
  untagResourceHandler,
  listTagsForResourceHandler,
} from "./handlers/tags";
import {
  createUserPoolDomainHandler,
  describeUserPoolDomainHandler,
  updateUserPoolDomainHandler,
  deleteUserPoolDomainHandler,
} from "./handlers/pool-domains";
import {
  getUICustomizationHandler,
  setUICustomizationHandler,
} from "./handlers/ui-customization";
import {
  confirmDeviceHandler,
  forgetDeviceHandler,
  getDeviceHandler,
  listDevicesHandler,
  updateDeviceStatusHandler,
  adminForgetDeviceHandler,
  adminGetDeviceHandler,
  adminListDevicesHandler,
  adminUpdateDeviceStatusHandler,
} from "./handlers/devices";
import {
  setRiskConfigurationHandler,
  describeRiskConfigurationHandler,
  adminListUserAuthEventsHandler,
  updateAuthEventFeedbackHandler,
  adminUpdateAuthEventFeedbackHandler,
} from "./handlers/risk-and-events";
import {
  createUserImportJobHandler,
  describeUserImportJobHandler,
  listUserImportJobsHandler,
  startUserImportJobHandler,
  stopUserImportJobHandler,
  getCSVHeaderHandler,
} from "./handlers/user-import-jobs";
import {
  adminLinkProviderForUserHandler,
  adminDisableProviderForUserHandler,
  setUserSettingsHandler,
  adminSetUserSettingsHandler,
  getSigningCertificateHandler,
} from "./handlers/misc-admin";

// Phase 7 — Groups
import { createGroupHandler } from "./handlers/create-group";
import { getGroupHandler } from "./handlers/get-group";
import { listGroupsHandler } from "./handlers/list-groups";
import { updateGroupHandler } from "./handlers/update-group";
import { deleteGroupHandler } from "./handlers/delete-group";
import { adminAddUserToGroupHandler } from "./handlers/admin-add-user-to-group";
import { adminRemoveUserFromGroupHandler } from "./handlers/admin-remove-user-from-group";
import { adminListGroupsForUserHandler } from "./handlers/admin-list-groups-for-user";
import { listUsersInGroupHandler } from "./handlers/list-users-in-group";

const TARGET_PREFIX = "AWSCognitoIdentityProviderService.";

export type SdkHandler = (req: Request, res: Response) => void | Promise<void>;
export type SdkHandlerFactory = (ctx: AppContext) => SdkHandler;

export function createSdkRouter(ctx: AppContext): Router {
  const router = Router();

  const handlers: Record<string, SdkHandler> = {
    // User self-service
    SignUp: signUpHandler(ctx),
    ConfirmSignUp: confirmSignUpHandler(ctx),
    ResendConfirmationCode: resendConfirmationCodeHandler(ctx),
    InitiateAuth: initiateAuthHandler(ctx),
    GetUser: getUserHandler(ctx),
    UpdateUserAttributes: updateUserAttributesHandler(ctx),
    DeleteUserAttributes: deleteUserAttributesHandler(ctx),
    DeleteUser: deleteUserHandler(ctx),
    ChangePassword: changePasswordHandler(ctx),
    ForgotPassword: forgotPasswordHandler(ctx),
    ConfirmForgotPassword: confirmForgotPasswordHandler(ctx),
    GlobalSignOut: globalSignOutHandler(ctx),
    GetUserAttributeVerificationCode:
      getUserAttributeVerificationCodeHandler(ctx),
    VerifyUserAttribute: verifyUserAttributeHandler(ctx),
    RevokeToken: revokeTokenHandler(ctx),

    // Admin
    AdminGetUser: adminGetUserHandler(ctx),
    AdminCreateUser: adminCreateUserHandler(ctx),
    AdminInitiateAuth: adminInitiateAuthHandler(ctx),
    AdminConfirmSignUp: adminConfirmSignUpHandler(ctx),
    AdminSetUserPassword: adminSetUserPasswordHandler(ctx),
    AdminDisableUser: adminDisableUserHandler(ctx),
    AdminEnableUser: adminEnableUserHandler(ctx),
    AdminResetUserPassword: adminResetUserPasswordHandler(ctx),
    AdminUserGlobalSignOut: adminUserGlobalSignOutHandler(ctx),
    AdminUpdateUserAttributes: adminUpdateUserAttributesHandler(ctx),
    AdminDeleteUserAttributes: adminDeleteUserAttributesHandler(ctx),
    AdminDeleteUser: adminDeleteUserHandler(ctx),

    // Pool management
    ListUsers: listUsersHandler(ctx),
    DescribeUserPool: describeUserPoolHandler(ctx),
    CreateUserPool: createUserPoolHandler(ctx),
    UpdateUserPool: updateUserPoolHandler(ctx),
    DeleteUserPool: deleteUserPoolHandler(ctx),
    ListUserPools: listUserPoolsHandler(ctx),
    CreateUserPoolClient: createUserPoolClientHandler(ctx),
    DescribeUserPoolClient: describeUserPoolClientHandler(ctx),
    ListUserPoolClients: listUserPoolClientsHandler(ctx),
    UpdateUserPoolClient: updateUserPoolClientHandler(ctx),
    DeleteUserPoolClient: deleteUserPoolClientHandler(ctx),

    // Groups
    CreateGroup: createGroupHandler(ctx),
    GetGroup: getGroupHandler(ctx),
    ListGroups: listGroupsHandler(ctx),
    UpdateGroup: updateGroupHandler(ctx),
    DeleteGroup: deleteGroupHandler(ctx),
    AdminAddUserToGroup: adminAddUserToGroupHandler(ctx),
    AdminRemoveUserFromGroup: adminRemoveUserFromGroupHandler(ctx),
    AdminListGroupsForUser: adminListGroupsForUserHandler(ctx),
    ListUsersInGroup: listUsersInGroupHandler(ctx),

    // Custom attributes
    AddCustomAttributes: addCustomAttributesHandler(ctx),

    // Challenges
    RespondToAuthChallenge: respondToAuthChallengeHandler(ctx),
    AdminRespondToAuthChallenge: adminRespondToAuthChallengeHandler(ctx),

    // MFA / TOTP
    AssociateSoftwareToken: associateSoftwareTokenHandler(ctx),
    VerifySoftwareToken: verifySoftwareTokenHandler(ctx),
    SetUserMFAPreference: setUserMFAPreferenceHandler(ctx),
    AdminSetUserMFAPreference: adminSetUserMFAPreferenceHandler(ctx),
    GetUserPoolMfaConfig: getUserPoolMfaConfigHandler(ctx),
    SetUserPoolMfaConfig: setUserPoolMfaConfigHandler(ctx),

    // Identity providers
    CreateIdentityProvider: createIdentityProviderHandler(ctx),
    DescribeIdentityProvider: describeIdentityProviderHandler(ctx),
    ListIdentityProviders: listIdentityProvidersHandler(ctx),
    UpdateIdentityProvider: updateIdentityProviderHandler(ctx),
    DeleteIdentityProvider: deleteIdentityProviderHandler(ctx),
    GetIdentityProviderByIdentifier:
      getIdentityProviderByIdentifierHandler(ctx),

    // Resource servers
    CreateResourceServer: createResourceServerHandler(ctx),
    DescribeResourceServer: describeResourceServerHandler(ctx),
    ListResourceServers: listResourceServersHandler(ctx),
    UpdateResourceServer: updateResourceServerHandler(ctx),
    DeleteResourceServer: deleteResourceServerHandler(ctx),

    // Tags
    TagResource: tagResourceHandler(ctx),
    UntagResource: untagResourceHandler(ctx),
    ListTagsForResource: listTagsForResourceHandler(ctx),

    // Pool domains
    CreateUserPoolDomain: createUserPoolDomainHandler(ctx),
    DescribeUserPoolDomain: describeUserPoolDomainHandler(ctx),
    UpdateUserPoolDomain: updateUserPoolDomainHandler(ctx),
    DeleteUserPoolDomain: deleteUserPoolDomainHandler(ctx),

    // UI customization
    GetUICustomization: getUICustomizationHandler(ctx),
    SetUICustomization: setUICustomizationHandler(ctx),

    // Devices
    ConfirmDevice: confirmDeviceHandler(ctx),
    ForgetDevice: forgetDeviceHandler(ctx),
    GetDevice: getDeviceHandler(ctx),
    ListDevices: listDevicesHandler(ctx),
    UpdateDeviceStatus: updateDeviceStatusHandler(ctx),
    AdminForgetDevice: adminForgetDeviceHandler(ctx),
    AdminGetDevice: adminGetDeviceHandler(ctx),
    AdminListDevices: adminListDevicesHandler(ctx),
    AdminUpdateDeviceStatus: adminUpdateDeviceStatusHandler(ctx),

    // Risk / events
    SetRiskConfiguration: setRiskConfigurationHandler(ctx),
    DescribeRiskConfiguration: describeRiskConfigurationHandler(ctx),
    AdminListUserAuthEvents: adminListUserAuthEventsHandler(ctx),
    UpdateAuthEventFeedback: updateAuthEventFeedbackHandler(ctx),
    AdminUpdateAuthEventFeedback: adminUpdateAuthEventFeedbackHandler(ctx),

    // User import jobs
    CreateUserImportJob: createUserImportJobHandler(ctx),
    DescribeUserImportJob: describeUserImportJobHandler(ctx),
    ListUserImportJobs: listUserImportJobsHandler(ctx),
    StartUserImportJob: startUserImportJobHandler(ctx),
    StopUserImportJob: stopUserImportJobHandler(ctx),
    GetCSVHeader: getCSVHeaderHandler(ctx),

    // Misc admin / certificate
    AdminLinkProviderForUser: adminLinkProviderForUserHandler(ctx),
    AdminDisableProviderForUser: adminDisableProviderForUserHandler(ctx),
    SetUserSettings: setUserSettingsHandler(ctx),
    AdminSetUserSettings: adminSetUserSettingsHandler(ctx),
    GetSigningCertificate: getSigningCertificateHandler(ctx),
  };

  router.post(
    "/",
    express.json({ type: "application/x-amz-json-1.1" }),
    async (req: Request, res: Response, next: NextFunction) => {
      const target = req.headers["x-amz-target"];
      if (typeof target !== "string" || !target.startsWith(TARGET_PREFIX)) {
        next();
        return;
      }

      const operation = target.slice(TARGET_PREFIX.length);
      const handler = handlers[operation];

      // Override res.json to apply the Cognito wire-format replacer
      // (Date -> unix seconds). Keeps content-type as application/json so
      // supertest auto-parses bodies in tests.
      const originalJson = res.json.bind(res);
      res.json = (body: unknown) => {
        return originalJson(JSON.parse(JSON.stringify(body, cognitoJsonReplacer)));
      };

      try {
        if (!handler) {
          if (ctx.config.devMode) {
            ctx.logger.info(
              { target, body: req.body },
              `Unsupported SDK operation: ${operation}`
            );
          }
          throw new UnsupportedError(operation);
        }

        await handler(req, res);
      } catch (err) {
        if (err instanceof CognitoError) {
          ctx.logger.debug(
            { code: err.code, operation, message: err.message },
            "Cognito error"
          );
          res.status(err.httpStatus).json(err.toResponseBody());
          return;
        }
        ctx.logger.error(
          { err, operation },
          "Unhandled error in SDK handler"
        );
        const e = err as Error;
        res.status(500).json({
          __type: "InternalErrorException",
          message: e.message ?? "Unknown error",
        });
      }
    }
  );

  return router;
}
