import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { AppContext } from "../../index";
import { InvalidParameterError, ResourceNotFoundError } from "../../errors";
import { AppClient } from "../../types";

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
      TokenValidityUnits,
      PreventUserExistenceErrors,
      SupportedIdentityProviders,
      ReadAttributes,
      WriteAttributes,
    } = req.body;

    if (!UserPoolId || !ClientName) {
      throw new InvalidParameterError("UserPoolId and ClientName are required.");
    }

    const pool = ctx.userPoolStore.getPool(UserPoolId);
    if (!pool) {
      throw new ResourceNotFoundError(
        `User pool ${UserPoolId} does not exist.`
      );
    }

    const clientId = uuidv4().replace(/-/g, "").substring(0, 26);
    const clientSecret = GenerateSecret
      ? uuidv4().replace(/-/g, "") + uuidv4().replace(/-/g, "")
      : undefined;

    const now = ctx.clock.now();
    const client: AppClient = {
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
      tokenValidityUnits: TokenValidityUnits && {
        accessToken: TokenValidityUnits.AccessToken,
        idToken: TokenValidityUnits.IdToken,
        refreshToken: TokenValidityUnits.RefreshToken,
      },
      preventUserExistenceErrors: PreventUserExistenceErrors,
      supportedIdentityProviders: SupportedIdentityProviders,
      readAttributes: ReadAttributes,
      writeAttributes: WriteAttributes,
      generateSecret: GenerateSecret,
      createdAt: now,
      updatedAt: now,
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
        TokenValidityUnits: client.tokenValidityUnits && {
          AccessToken: client.tokenValidityUnits.accessToken,
          IdToken: client.tokenValidityUnits.idToken,
          RefreshToken: client.tokenValidityUnits.refreshToken,
        },
        PreventUserExistenceErrors: client.preventUserExistenceErrors,
        SupportedIdentityProviders: client.supportedIdentityProviders,
        ReadAttributes: client.readAttributes,
        WriteAttributes: client.writeAttributes,
        CreationDate: client.createdAt,
        LastModifiedDate: client.updatedAt,
      },
    });
  };
}
