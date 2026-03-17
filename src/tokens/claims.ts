import crypto from "crypto";
import { CognitoUser } from "../types";

export function buildAccessTokenClaims(
  user: CognitoUser,
  clientId: string,
  scope: string
): Record<string, unknown> {
  return {
    sub: user.username,
    token_use: "access",
    scope,
    client_id: clientId,
    username: user.username,
    "cognito:groups": user.groups,
    event_id: crypto.randomUUID(),
    auth_time: Math.floor(Date.now() / 1000),
  };
}

export function buildIdTokenClaims(
  user: CognitoUser,
  clientId: string,
  nonce?: string
): Record<string, unknown> {
  const claims: Record<string, unknown> = {
    sub: user.username,
    token_use: "id",
    "cognito:username": user.username,
    "cognito:groups": user.groups,
    email: user.email,
    email_verified: user.attributes.email_verified === "true",
    auth_time: Math.floor(Date.now() / 1000),
  };

  // Add standard profile claims from attributes
  const profileAttrs = [
    "given_name",
    "family_name",
    "name",
    "nickname",
    "phone_number",
    "picture",
    "locale",
    "address",
    "birthdate",
    "gender",
    "middle_name",
    "preferred_username",
    "profile",
    "website",
    "zoneinfo",
  ];

  for (const attr of profileAttrs) {
    if (user.attributes[attr]) {
      claims[attr] = user.attributes[attr];
    }
  }

  if (nonce) {
    claims.nonce = nonce;
  }

  return claims;
}
