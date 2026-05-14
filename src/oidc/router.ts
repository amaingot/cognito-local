import { Router } from "express";
import express from "express";
import { AppContext } from "../index";
import { getKid } from "../crypto";
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

  // ALB-style public-keys endpoint (fixes upstream #365)
  // GET /<kid> returns the PEM-encoded public key for that kid
  router.get("/:kid", (req, res, next) => {
    if (req.params.kid !== getKid()) {
      next();
      return;
    }
    const pem = (
      ctx.keys.publicKey.export({ format: "pem", type: "spki" }) as string
    ).trim();
    res.set("Content-Type", "text/plain").send(pem);
  });

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
