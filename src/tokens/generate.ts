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

export function generateTokens(
  user: CognitoUser,
  clientId: string,
  keys: KeyPair,
  issuer: string,
  scope: string,
  expiresIn: number,
  nonce?: string
): Omit<GeneratedTokens, "refreshToken"> {
  const accessClaims = buildAccessTokenClaims(user, clientId, scope);
  const accessToken = jwt.sign(accessClaims, keys.privateKey, {
    algorithm: "RS256",
    keyid: getKid(),
    issuer,
    expiresIn,
  });

  const idClaims = buildIdTokenClaims(user, clientId, nonce);

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
