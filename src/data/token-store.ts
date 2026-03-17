import crypto from "crypto";
import { AuthCode, RefreshTokenEntry } from "../types";

export class TokenStore {
  private authCodes = new Map<string, AuthCode>();
  private refreshTokens = new Map<string, RefreshTokenEntry>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    // Clean up expired auth codes every 60s
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [code, data] of this.authCodes) {
        if (now - data.createdAt > 120_000) this.authCodes.delete(code);
      }
    }, 60_000);
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
  }

  createAuthCode(
    userId: string,
    clientId: string,
    redirectUri: string,
    scope: string,
    nonce?: string,
    codeChallenge?: string,
    codeChallengeMethod?: string
  ): string {
    const code = crypto.randomBytes(32).toString("base64url");
    this.authCodes.set(code, {
      code,
      userId,
      clientId,
      redirectUri,
      scope,
      nonce,
      codeChallenge,
      codeChallengeMethod,
      createdAt: Date.now(),
    });
    return code;
  }

  consumeAuthCode(code: string): AuthCode | undefined {
    const entry = this.authCodes.get(code);
    if (entry) {
      this.authCodes.delete(code);
    }
    return entry;
  }

  createRefreshToken(
    userId: string,
    clientId: string,
    userPoolId: string,
    validitySeconds: number
  ): string {
    const token = crypto.randomBytes(64).toString("base64url");
    const now = Date.now();
    this.refreshTokens.set(token, {
      token,
      userId,
      clientId,
      userPoolId,
      createdAt: now,
      expiresAt: now + validitySeconds * 1000,
    });
    return token;
  }

  getRefreshToken(token: string): RefreshTokenEntry | undefined {
    const entry = this.refreshTokens.get(token);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.refreshTokens.delete(token);
      return undefined;
    }
    return entry;
  }

  revokeRefreshToken(token: string): void {
    this.refreshTokens.delete(token);
  }

  revokeUserTokens(userId: string): void {
    for (const [token, entry] of this.refreshTokens) {
      if (entry.userId === userId) {
        this.refreshTokens.delete(token);
      }
    }
  }
}
