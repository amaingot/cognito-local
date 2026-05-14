import { Request, Response } from "express";
import { AppContext } from "../../index";
import { InvalidParameterError, ResourceNotFoundError } from "../../errors";

export function describeUserPoolClientHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { UserPoolId, ClientId } = req.body;
    if (!UserPoolId || !ClientId) {
      throw new InvalidParameterError(
        "UserPoolId and ClientId are required."
      );
    }
    const client = ctx.clientStore.getClient(ClientId);
    if (!client || client.userPoolId !== UserPoolId) {
      throw new ResourceNotFoundError(`Client ${ClientId} not found.`);
    }
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
