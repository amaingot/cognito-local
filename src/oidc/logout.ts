import { Request, Response } from "express";
import { AppContext } from "../index";

export function createLogoutHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const {
      // Standard OIDC params (used by oidc-client-ts signoutRedirect)
      post_logout_redirect_uri,
      state,
      // Cognito-style params
      client_id,
      logout_uri,
    } = req.query as Record<string, string | undefined>;

    const redirectUri = post_logout_redirect_uri || logout_uri;

    if (!redirectUri) {
      res.send(
        "<!DOCTYPE html><html><body><h2>Logged out</h2><p>You have been logged out.</p></body></html>"
      );
      return;
    }

    // Collect all allowed logout URIs from all clients (or a specific client if client_id given)
    let allowedLogoutUris: string[] = [];
    if (client_id) {
      const client = ctx.clientStore.getClient(client_id);
      if (client) {
        allowedLogoutUris = client.logoutUrls;
      }
    } else {
      // Check all clients in the pool
      const clients = ctx.clientStore.getClientsByPool(ctx.config.userPoolId);
      allowedLogoutUris = clients.flatMap((c) => c.logoutUrls);
    }

    if (!allowedLogoutUris.includes(redirectUri)) {
      res.status(400).send(`Invalid redirect_uri: ${redirectUri}`);
      return;
    }

    const url = new URL(redirectUri);
    if (state) url.searchParams.set("state", state);

    console.log(`Logout: redirecting to ${url.toString()}`);
    res.redirect(url.toString());
  };
}
