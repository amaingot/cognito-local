import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError, ResourceNotFoundError } from "../../errors";

export function updateUserPoolClientHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const {
      UserPoolId,
      ClientId,
      ClientName,
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
    if (!UserPoolId || !ClientId) {
      throw new InvalidParameterError(
        "UserPoolId and ClientId are required."
      );
    }
    const client = ctx.clientStore.getClient(ClientId);
    if (!client || client.userPoolId !== UserPoolId) {
      throw new ResourceNotFoundError(`Client ${ClientId} not found.`);
    }
    const updated = {
      ...client,
      clientName: ClientName ?? client.clientName,
      callbackUrls: CallbackURLs ?? client.callbackUrls,
      logoutUrls: LogoutURLs ?? client.logoutUrls,
      explicitAuthFlows: ExplicitAuthFlows ?? client.explicitAuthFlows,
      allowedOAuthFlows: AllowedOAuthFlows ?? client.allowedOAuthFlows,
      allowedOAuthScopes: AllowedOAuthScopes ?? client.allowedOAuthScopes,
      accessTokenValidity: AccessTokenValidity ?? client.accessTokenValidity,
      idTokenValidity: IdTokenValidity ?? client.idTokenValidity,
      refreshTokenValidity:
        RefreshTokenValidity ?? client.refreshTokenValidity,
      tokenValidityUnits: TokenValidityUnits
        ? {
            accessToken: TokenValidityUnits.AccessToken,
            idToken: TokenValidityUnits.IdToken,
            refreshToken: TokenValidityUnits.RefreshToken,
          }
        : client.tokenValidityUnits,
      preventUserExistenceErrors:
        PreventUserExistenceErrors ?? client.preventUserExistenceErrors,
      supportedIdentityProviders:
        SupportedIdentityProviders ?? client.supportedIdentityProviders,
      readAttributes: ReadAttributes ?? client.readAttributes,
      writeAttributes: WriteAttributes ?? client.writeAttributes,
    };
    ctx.clientStore.updateClient(updated);
    res.json({
      UserPoolClient: {
        ClientId: updated.clientId,
        ClientName: updated.clientName,
        UserPoolId: updated.userPoolId,
        ClientSecret: updated.clientSecret,
        CallbackURLs: updated.callbackUrls,
        LogoutURLs: updated.logoutUrls,
        ExplicitAuthFlows: updated.explicitAuthFlows,
        AllowedOAuthFlows: updated.allowedOAuthFlows,
        AllowedOAuthScopes: updated.allowedOAuthScopes,
        AccessTokenValidity: updated.accessTokenValidity,
        IdTokenValidity: updated.idTokenValidity,
        RefreshTokenValidity: updated.refreshTokenValidity,
        CreationDate: updated.createdAt,
        LastModifiedDate: updated.updatedAt,
      },
    });
  };
}
