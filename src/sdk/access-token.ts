import jwt from "jsonwebtoken";
import { AppContext } from "../index";
import { NotAuthorizedError } from "../errors";
import { CognitoUser, UserPool } from "../types";

interface AccessTokenClaims {
  sub: string;
  client_id?: string;
  username?: string;
  scope?: string;
  exp?: number;
}

/**
 * Resolve a user from a Bearer access token. Throws NotAuthorizedError if
 * the token is missing, malformed, expired, or doesn't match a user.
 */
export function resolveUserFromAccessToken(
  ctx: AppContext,
  accessToken: string
): { user: CognitoUser; pool: UserPool; clientId?: string } {
  let claims: AccessTokenClaims;
  try {
    claims = jwt.verify(accessToken, ctx.keys.publicKey, {
      algorithms: ["RS256"],
    }) as AccessTokenClaims;
  } catch {
    throw new NotAuthorizedError("Invalid Access Token");
  }

  if (ctx.tokenStore.isRevoked(accessToken)) {
    throw new NotAuthorizedError("Access Token has been revoked");
  }

  const clientId = claims.client_id;
  const client = clientId ? ctx.clientStore.getClient(clientId) : undefined;

  const poolId = client?.userPoolId ?? ctx.config.pools[0]?.id;
  if (!poolId) {
    throw new NotAuthorizedError("Unknown user pool for token");
  }

  const pool = ctx.userPoolStore.getPool(poolId);
  if (!pool) {
    throw new NotAuthorizedError("User pool not found");
  }

  const sub = claims.sub;
  const user =
    ctx.userPoolStore.getUser(poolId, sub) ??
    ctx.userPoolStore.getUserBySub(poolId, sub) ??
    (claims.username
      ? ctx.userPoolStore.getUser(poolId, claims.username)
      : undefined);

  if (!user) {
    throw new NotAuthorizedError("User not found for access token");
  }

  if (!user.enabled) {
    throw new NotAuthorizedError("User is disabled");
  }

  return { user, pool, clientId };
}
