import crypto from "crypto";
import { Request, Response } from "express";
import { AppContext } from "../index";
import { generateTokens } from "../tokens/generate";

export function createTokenHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const {
      grant_type,
      code,
      redirect_uri,
      code_verifier,
      username,
      password,
      scope,
      refresh_token,
      client_id: bodyClientId,
      client_secret: bodyClientSecret,
    } = req.body as Record<string, string | undefined>;

    // Extract client credentials from Basic auth header or body
    let clientId = bodyClientId;
    let clientSecret: string | undefined = bodyClientSecret;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Basic ")) {
      const decoded = Buffer.from(authHeader.slice(6), "base64").toString();
      const colonIndex = decoded.indexOf(":");
      if (colonIndex !== -1) {
        clientId = decodeURIComponent(decoded.substring(0, colonIndex));
        clientSecret = decodeURIComponent(decoded.substring(colonIndex + 1));
      }
    }

    if (!clientId) {
      res.status(400).json({ error: "invalid_request", error_description: "Missing client_id" });
      return;
    }

    const client = ctx.clientStore.getClient(clientId);
    if (!client) {
      res.status(400).json({ error: "invalid_client" });
      return;
    }

    // Verify client secret if the client has one configured
    if (client.clientSecret && client.clientSecret !== clientSecret) {
      res.status(401).json({ error: "invalid_client" });
      return;
    }

    const issuer = `${ctx.config.issuerHost}/${ctx.config.userPoolId}`;

    // --- Password grant ---
    if (grant_type === "password") {
      if (!username || !password) {
        res.status(400).json({ error: "invalid_request", error_description: "Missing username or password" });
        return;
      }

      const user = ctx.userPoolStore.getUserByEmail(client.userPoolId, username);
      if (!user || user.password !== password) {
        console.error(`Password grant failed: invalid credentials for ${username}`);
        res.status(400).json({ error: "invalid_grant" });
        return;
      }

      const resolvedScope = scope || "openid";
      const tokens = generateTokens(
        user,
        clientId,
        ctx.keys,
        issuer,
        resolvedScope,
        client.accessTokenValidity
      );

      const refreshToken = ctx.tokenStore.createRefreshToken(
        user.username,
        clientId,
        client.userPoolId,
        client.refreshTokenValidity
      );

      console.log(`Token issued (password grant) for: ${user.email} (${user.username})`);

      res.json({
        access_token: tokens.accessToken,
        id_token: tokens.idToken,
        refresh_token: refreshToken,
        token_type: "Bearer",
        expires_in: tokens.expiresIn,
        scope: tokens.scope,
      });
      return;
    }

    // --- Refresh token grant ---
    if (grant_type === "refresh_token") {
      if (!refresh_token) {
        res.status(400).json({ error: "invalid_request", error_description: "Missing refresh_token" });
        return;
      }

      const entry = ctx.tokenStore.getRefreshToken(refresh_token);
      if (!entry) {
        console.error("Refresh token exchange failed: invalid or expired token");
        res.status(400).json({ error: "invalid_grant" });
        return;
      }

      if (entry.clientId !== clientId) {
        console.error("Refresh token exchange failed: client_id mismatch");
        res.status(400).json({ error: "invalid_grant" });
        return;
      }

      const user = ctx.userPoolStore.getUser(entry.userPoolId, entry.userId);
      if (!user) {
        console.error("Refresh token exchange failed: user not found");
        res.status(400).json({ error: "invalid_grant" });
        return;
      }

      const resolvedScope = scope || "openid";
      const tokens = generateTokens(
        user,
        clientId,
        ctx.keys,
        issuer,
        resolvedScope,
        client.accessTokenValidity
      );

      console.log(`Token issued (refresh_token grant) for: ${user.email} (${user.username})`);

      res.json({
        access_token: tokens.accessToken,
        id_token: tokens.idToken,
        refresh_token: refresh_token,
        token_type: "Bearer",
        expires_in: tokens.expiresIn,
        scope: tokens.scope,
      });
      return;
    }

    // --- Authorization code grant ---
    if (grant_type !== "authorization_code") {
      res.status(400).json({ error: "unsupported_grant_type" });
      return;
    }

    if (!code) {
      res.status(400).json({ error: "invalid_request", error_description: "Missing code" });
      return;
    }

    const stored = ctx.tokenStore.consumeAuthCode(code);
    if (!stored) {
      console.error("Token exchange failed: invalid or expired code");
      res.status(400).json({ error: "invalid_grant" });
      return;
    }

    // Verify redirect_uri matches
    if (redirect_uri && redirect_uri !== stored.redirectUri) {
      console.error("Token exchange failed: redirect_uri mismatch");
      res.status(400).json({ error: "invalid_grant" });
      return;
    }

    // Verify client_id matches the code
    if (stored.clientId !== clientId) {
      console.error("Token exchange failed: client_id mismatch");
      res.status(400).json({ error: "invalid_grant" });
      return;
    }

    // Verify PKCE if a code_challenge was sent in the auth request
    if (stored.codeChallenge) {
      if (!code_verifier) {
        console.error("Token exchange failed: missing code_verifier");
        res.status(400).json({ error: "invalid_grant" });
        return;
      }
      const hash = crypto
        .createHash("sha256")
        .update(code_verifier)
        .digest("base64url");
      if (hash !== stored.codeChallenge) {
        console.error("Token exchange failed: PKCE verification failed");
        res.status(400).json({ error: "invalid_grant" });
        return;
      }
    }

    const user = ctx.userPoolStore.getUser(client.userPoolId, stored.userId);
    if (!user) {
      console.error("Token exchange failed: user not found");
      res.status(400).json({ error: "invalid_grant" });
      return;
    }

    const tokens = generateTokens(
      user,
      clientId,
      ctx.keys,
      issuer,
      stored.scope,
      client.accessTokenValidity,
      stored.nonce
    );

    const refreshToken = ctx.tokenStore.createRefreshToken(
      user.username,
      clientId,
      client.userPoolId,
      client.refreshTokenValidity
    );

    console.log(`Token issued for: ${user.email} (${user.username})`);

    res.json({
      access_token: tokens.accessToken,
      id_token: tokens.idToken,
      refresh_token: refreshToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      scope: tokens.scope,
    });
  };
}
