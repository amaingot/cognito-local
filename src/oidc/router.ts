import { Router } from "express";
import express from "express";
import { AppContext } from "../index";
import { createDiscoveryHandler } from "./discovery";
import { createJwksHandler } from "./jwks";
import { createAuthorizeHandler, createAuthorizeCallbackHandler } from "./authorize";
import { createTokenHandler } from "./token";
import { createUserInfoHandler } from "./userinfo";
import { createLogoutHandler } from "./logout";
import { createRevokeHandler } from "./revoke";

export function createOidcRouter(ctx: AppContext): Router {
  const router = Router();

  const urlEncoded = express.urlencoded({ extended: false });

  // Discovery & JWKS
  router.get("/:poolId/.well-known/openid-configuration", createDiscoveryHandler(ctx));
  router.get("/:poolId/.well-known/jwks.json", createJwksHandler(ctx));

  // Authorization (login page + callback)
  router.get("/oauth2/authorize", createAuthorizeHandler(ctx));
  router.post("/oauth2/authorize/callback", urlEncoded, createAuthorizeCallbackHandler(ctx));

  // Token exchange
  router.post("/oauth2/token", urlEncoded, createTokenHandler(ctx));

  // User info
  router.get("/oauth2/userInfo", createUserInfoHandler(ctx));

  // Logout
  router.get("/logout", createLogoutHandler(ctx));

  // Token revocation
  router.post("/oauth2/revoke", urlEncoded, createRevokeHandler(ctx));

  return router;
}
