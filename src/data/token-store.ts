import crypto from "crypto";
import { DataStore } from "./store";
import { AuthCode, RefreshTokenEntry, SessionEntry } from "../types";

export class TokenStore {
  private authCodes: DataStore<AuthCode>;
  private refreshTokens: DataStore<RefreshTokenEntry>;
  private sessions: DataStore<SessionEntry>;
  private revokedTokens: DataStore<{ token: string; revokedAt: number }>;
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(dataDir: string) {
    this.authCodes = new DataStore<AuthCode>(dataDir, "auth-codes.json");
    this.refreshTokens = new DataStore<RefreshTokenEntry>(
      dataDir,
      "refresh-tokens.json"
    );
    this.sessions = new DataStore<SessionEntry>(dataDir, "sessions.json");
    this.revokedTokens = new DataStore<{ token: string; revokedAt: number }>(
      dataDir,
      "revoked-tokens.json"
    );

    // Clean up expired auth codes and sessions every 60s
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [code, data] of this.authCodes.entries()) {
        if (now - data.createdAt > 120_000) this.authCodes.delete(code);
      }
      for (const [s, entry] of this.sessions.entries()) {
        if (now > entry.expiresAt) this.sessions.delete(s);
      }
    }, 60_000);
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
  }

  // -------------------- Auth codes --------------------

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

  // -------------------- Refresh tokens --------------------

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
    if (entry.revoked) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.refreshTokens.delete(token);
      return undefined;
    }
    return entry;
  }

  revokeRefreshToken(token: string): void {
    const entry = this.refreshTokens.get(token);
    if (!entry) return;
    this.refreshTokens.set(token, { ...entry, revoked: true });
    this.revokedTokens.set(token, { token, revokedAt: Date.now() });
  }

  revokeUserTokens(userId: string, poolId?: string): number {
    let count = 0;
    for (const [token, entry] of this.refreshTokens.entries()) {
      if (entry.userId === userId && (!poolId || entry.userPoolId === poolId)) {
        this.revokeRefreshToken(token);
        count++;
      }
    }
    return count;
  }

  isRevoked(token: string): boolean {
    return this.revokedTokens.has(token);
  }

  listUserRefreshTokens(userId: string, poolId: string): RefreshTokenEntry[] {
    return this.refreshTokens
      .values()
      .filter(
        (t) => t.userId === userId && t.userPoolId === poolId && !t.revoked
      );
  }

  // -------------------- Sessions (for RespondToAuthChallenge) --------------------

  createSession(
    challengeName: string,
    username: string,
    clientId: string,
    userPoolId: string,
    metadata?: Record<string, unknown>,
    ttlMs = 5 * 60 * 1000
  ): string {
    const session = crypto.randomBytes(64).toString("base64url");
    const now = Date.now();
    this.sessions.set(session, {
      session,
      challengeName,
      username,
      clientId,
      userPoolId,
      metadata,
      createdAt: now,
      expiresAt: now + ttlMs,
    });
    return session;
  }

  getSession(session: string): SessionEntry | undefined {
    const entry = this.sessions.get(session);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.sessions.delete(session);
      return undefined;
    }
    return entry;
  }

  consumeSession(session: string): SessionEntry | undefined {
    const entry = this.getSession(session);
    if (entry) this.sessions.delete(session);
    return entry;
  }
}
