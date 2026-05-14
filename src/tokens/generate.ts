import crypto from "crypto";
import jwt from "jsonwebtoken";
import { CognitoUser } from "../types";
import { KeyPair, getKid } from "../crypto";
import { buildAccessTokenClaims, buildIdTokenClaims } from "./claims";

export interface GeneratedTokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string;
}

export interface TriggerClaimsOverride {
  claimsToAddOrOverride?: Record<string, string | number | boolean>;
  claimsToSuppress?: string[];
  groupOverrideDetails?: {
    groupsToOverride?: string[];
    iamRolesToOverride?: string[];
    preferredRole?: string;
  };
}

export interface TokenOverrides {
  idToken?: TriggerClaimsOverride;
  accessToken?: TriggerClaimsOverride; // V2 only
}

const RESERVED_CLAIMS = new Set([
  "acr",
  "amr",
  "aud",
  "at_hash",
  "auth_time",
  "azp",
  "cognito:username",
  "exp",
  "iat",
  "identities",
  "iss",
  "jti",
  "nbf",
  "nonce",
  "origin_jti",
  "sub",
  "token_use",
]);

function applyOverrides(
  claims: Record<string, unknown>,
  ov: TriggerClaimsOverride | undefined
): Record<string, unknown> {
  if (!ov) return claims;
  const out: Record<string, unknown> = { ...claims };
  if (ov.claimsToAddOrOverride) {
    for (const [k, v] of Object.entries(ov.claimsToAddOrOverride)) {
      if (!RESERVED_CLAIMS.has(k)) out[k] = v;
    }
  }
  if (ov.claimsToSuppress) {
    for (const k of ov.claimsToSuppress) {
      if (!RESERVED_CLAIMS.has(k)) delete out[k];
    }
  }
  if (ov.groupOverrideDetails?.groupsToOverride) {
    out["cognito:groups"] = ov.groupOverrideDetails.groupsToOverride;
  }
  if (ov.groupOverrideDetails?.preferredRole) {
    out["cognito:preferred_role"] = ov.groupOverrideDetails.preferredRole;
  }
  if (ov.groupOverrideDetails?.iamRolesToOverride) {
    out["cognito:roles"] = ov.groupOverrideDetails.iamRolesToOverride;
  }
  return out;
}

export function generateTokens(
  user: CognitoUser,
  clientId: string,
  keys: KeyPair,
  issuer: string,
  scope: string,
  expiresIn: number,
  nonce?: string,
  overrides?: TokenOverrides
): Omit<GeneratedTokens, "refreshToken"> {
  const accessClaims = applyOverrides(
    buildAccessTokenClaims(user, clientId, scope),
    overrides?.accessToken
  );
  const accessToken = jwt.sign(accessClaims, keys.privateKey, {
    algorithm: "RS256",
    keyid: getKid(),
    issuer,
    expiresIn,
  });

  const idClaims = applyOverrides(
    buildIdTokenClaims(user, clientId, nonce),
    overrides?.idToken
  );

  // Compute at_hash
  const atHashFull = crypto.createHash("sha256").update(accessToken).digest();
  idClaims.at_hash = atHashFull
    .subarray(0, atHashFull.length / 2)
    .toString("base64url");

  const idToken = jwt.sign(idClaims, keys.privateKey, {
    algorithm: "RS256",
    keyid: getKid(),
    issuer,
    audience: clientId,
    expiresIn,
  });

  return { accessToken, idToken, expiresIn, scope };
}
