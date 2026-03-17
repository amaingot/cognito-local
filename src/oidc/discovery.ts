import { Request, Response } from "express";
import { AppContext } from "../index";

export function createDiscoveryHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const poolId = req.params.poolId;
    const { config } = ctx;
    const issuer = `${config.issuerHost}/${poolId}`;

    res.json({
      issuer,
      authorization_endpoint: `${config.issuerHost}/oauth2/authorize`,
      token_endpoint: `${config.issuerHost}/oauth2/token`,
      userinfo_endpoint: `${config.issuerHost}/oauth2/userInfo`,
      jwks_uri: `${config.issuerHost}/${poolId}/.well-known/jwks.json`,
      end_session_endpoint: `${config.issuerHost}/logout`,
      revocation_endpoint: `${config.issuerHost}/oauth2/revoke`,
      response_types_supported: ["code"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256"],
      scopes_supported: ["openid", "email", "phone", "profile"],
      token_endpoint_auth_methods_supported: [
        "client_secret_basic",
        "client_secret_post",
      ],
      claims_supported: [
        "sub",
        "iss",
        "aud",
        "exp",
        "iat",
        "email",
        "email_verified",
        "name",
        "nickname",
        "given_name",
        "family_name",
        "cognito:username",
        "cognito:groups",
      ],
      code_challenge_methods_supported: ["S256"],
      grant_types_supported: ["authorization_code", "password", "refresh_token"],
    });
  };
}
