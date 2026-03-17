import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { AppContext } from "../../index";
import { invalidParameterError, resourceNotFoundError } from "../errors";

export function createUserPoolClientHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const {
      UserPoolId,
      ClientName,
      GenerateSecret,
      CallbackURLs,
      LogoutURLs,
      ExplicitAuthFlows,
      AllowedOAuthFlows,
      AllowedOAuthScopes,
      AccessTokenValidity,
      IdTokenValidity,
      RefreshTokenValidity,
    } = req.body;

    if (!UserPoolId || !ClientName) {
      invalidParameterError(res, "UserPoolId and ClientName are required.");
      return;
    }

    const pool = ctx.userPoolStore.getPool(UserPoolId);
    if (!pool) {
      resourceNotFoundError(res, `User pool ${UserPoolId} does not exist.`);
      return;
    }

    const clientId = uuidv4().replace(/-/g, "").substring(0, 26);
    const clientSecret = GenerateSecret
      ? uuidv4().replace(/-/g, "") + uuidv4().replace(/-/g, "")
      : undefined;

    const client = {
      clientId,
      clientSecret,
      clientName: ClientName,
      userPoolId: UserPoolId,
      callbackUrls: CallbackURLs || [],
      logoutUrls: LogoutURLs || [],
      explicitAuthFlows: ExplicitAuthFlows || [],
      allowedOAuthFlows: AllowedOAuthFlows || [],
      allowedOAuthScopes: AllowedOAuthScopes || [],
      accessTokenValidity: AccessTokenValidity || 3600,
      idTokenValidity: IdTokenValidity || 3600,
      refreshTokenValidity: RefreshTokenValidity || 30 * 24 * 3600,
    };

    ctx.clientStore.createClient(client);

    res.json({
      UserPoolClient: {
        ClientId: client.clientId,
        ClientName: client.clientName,
        UserPoolId: client.userPoolId,
        ClientSecret: client.clientSecret,
        CallbackURLs: client.callbackUrls,
        LogoutURLs: client.logoutUrls,
        ExplicitAuthFlows: client.explicitAuthFlows,
        AllowedOAuthFlows: client.allowedOAuthFlows,
        AllowedOAuthScopes: client.allowedOAuthScopes,
        AccessTokenValidity: client.accessTokenValidity,
        IdTokenValidity: client.idTokenValidity,
        RefreshTokenValidity: client.refreshTokenValidity,
      },
    });
  };
}
