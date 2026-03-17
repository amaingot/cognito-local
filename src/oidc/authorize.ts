import { Request, Response } from "express";
import { AppContext } from "../index";
import { renderLoginPage } from "./login-page";

export function createAuthorizeHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const {
      client_id,
      redirect_uri,
      response_type,
      scope,
      state,
      nonce,
      code_challenge,
      code_challenge_method,
    } = req.query as Record<string, string | undefined>;

    if (!client_id) {
      res.status(400).send("Missing client_id");
      return;
    }

    const client = ctx.clientStore.getClient(client_id);
    if (!client) {
      res.status(400).send("Unknown client_id");
      return;
    }

    if (redirect_uri && !client.callbackUrls.includes(redirect_uri)) {
      res.status(400).send(`Invalid redirect_uri: ${redirect_uri}`);
      return;
    }

    const users = ctx.userPoolStore.listUsers(client.userPoolId);

    res.send(
      renderLoginPage(users, {
        client_id,
        redirect_uri,
        response_type,
        scope,
        state,
        nonce,
        code_challenge,
        code_challenge_method,
      })
    );
  };
}

export function createAuthorizeCallbackHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const {
      userId,
      client_id,
      redirect_uri,
      scope,
      state,
      nonce,
      code_challenge,
      code_challenge_method,
    } = req.body as Record<string, string | undefined>;

    if (!userId || !client_id) {
      res.status(400).send("Missing userId or client_id");
      return;
    }

    const client = ctx.clientStore.getClient(client_id);
    if (!client) {
      res.status(400).send("Unknown client_id");
      return;
    }

    const user = ctx.userPoolStore.getUser(client.userPoolId, userId);
    if (!user) {
      res.status(400).send("Unknown user");
      return;
    }

    const resolvedRedirectUri = redirect_uri || client.callbackUrls[0];
    const resolvedScope = scope || "openid";

    const code = ctx.tokenStore.createAuthCode(
      user.username,
      client_id,
      resolvedRedirectUri,
      resolvedScope,
      nonce,
      code_challenge,
      code_challenge_method
    );

    const url = new URL(resolvedRedirectUri);
    url.searchParams.set("code", code);
    if (state) url.searchParams.set("state", state);

    console.log(`Login: ${user.email} (${user.username}) -> code issued`);
    res.redirect(url.toString());
  };
}
