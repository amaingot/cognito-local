import { v4 as uuidv4 } from "uuid";
import { DataStore } from "./store";
import {
  AppConfig,
  CognitoUser,
  PoolConfig,
  UserPool,
  UserConfig,
} from "../types";

export interface ListUsersOptions {
  filter?: string;
  limit?: number;
  paginationToken?: string;
  attributesToGet?: string[];
}

/**
 * UserPoolStore — multi-pool persistence for pools and users.
 *
 * Keys:
 *  - pools indexed by poolId
 *  - users indexed by `${poolId}:${internalUsername}`
 */
export class UserPoolStore {
  private pools: DataStore<UserPool>;
  private users: DataStore<CognitoUser>;

  constructor(dataDir: string) {
    this.pools = new DataStore<UserPool>(dataDir, "pools.json");
    this.users = new DataStore<CognitoUser>(dataDir, "users.json");
  }

  initFromConfig(config: AppConfig, seedUsers: UserConfig[]): void {
    const now = new Date();
    for (const pc of config.pools) {
      if (!this.pools.has(pc.id)) {
        this.pools.set(pc.id, this.poolFromConfig(pc, config.region, now));
      } else {
        // Update existing pool with latest schema/MFA config (in case config changed)
        const existing = this.pools.get(pc.id)!;
        this.pools.set(pc.id, {
          ...existing,
          name: pc.name,
          usernameAttributes: pc.usernameAttributes,
          usernameCaseSensitive: pc.usernameCaseSensitive,
          autoVerifiedAttributes: pc.autoVerifiedAttributes,
          mfaConfiguration: pc.mfaConfiguration,
          passwordPolicy: pc.passwordPolicy,
          schema: pc.schemaAttributes,
          updatedAt: now,
        });
      }
    }

    // Seed users from users.json
    for (const u of seedUsers) {
      const poolId = u.poolId ?? config.pools[0]?.id;
      if (!poolId) continue;
      const internalUsername = u.username || uuidv4();
      const key = this.userKey(poolId, internalUsername);
      if (this.users.has(key)) continue;
      this.users.set(key, {
        username: internalUsername,
        email: u.email.toLowerCase(),
        password: u.password,
        attributes: {
          email: u.email.toLowerCase(),
          email_verified: "true",
          sub: internalUsername,
          ...u.attributes,
        },
        groups: u.groups ?? [],
        status: u.status ?? "CONFIRMED",
        enabled: true,
        refreshTokens: [],
        userPoolId: poolId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
    }
  }

  private poolFromConfig(
    pc: PoolConfig,
    defaultRegion: string,
    now: Date
  ): UserPool {
    return {
      id: pc.id,
      name: pc.name,
      region: pc.region ?? defaultRegion,
      usernameAttributes: pc.usernameAttributes,
      usernameCaseSensitive: pc.usernameCaseSensitive,
      autoVerifiedAttributes: pc.autoVerifiedAttributes,
      mfaConfiguration: pc.mfaConfiguration,
      passwordPolicy: pc.passwordPolicy,
      schema: pc.schemaAttributes,
      arn: `arn:aws:cognito-idp:${pc.region ?? defaultRegion}:000000000000:userpool/${pc.id}`,
      createdAt: now,
      updatedAt: now,
    };
  }

  // -------------------- Pools --------------------

  listPools(): UserPool[] {
    return this.pools.values();
  }

  getPool(poolId: string): UserPool | undefined {
    return this.pools.get(poolId);
  }

  createPool(pool: UserPool): void {
    this.pools.set(pool.id, pool);
  }

  updatePool(pool: UserPool): void {
    this.pools.set(pool.id, { ...pool, updatedAt: new Date() });
  }

  deletePool(poolId: string): boolean {
    // Also delete users in that pool
    for (const [k, u] of this.users.entries()) {
      if (u.userPoolId === poolId) this.users.delete(k);
    }
    return this.pools.delete(poolId);
  }

  // -------------------- Users --------------------

  private userKey(poolId: string, username: string): string {
    return `${poolId}:${username}`;
  }

  private normalizeForPool(pool: UserPool | undefined, value: string): string {
    if (pool && !pool.usernameCaseSensitive) return value.toLowerCase();
    return value;
  }

  getUser(poolId: string, username: string): CognitoUser | undefined {
    const pool = this.getPool(poolId);
    // Direct key lookup first (internal username = sub)
    const direct = this.users.get(this.userKey(poolId, username));
    if (direct) return direct;

    // Fallback: case-insensitive scan if pool is case-insensitive
    if (pool && !pool.usernameCaseSensitive) {
      const needle = username.toLowerCase();
      return this.users
        .values()
        .find(
          (u) =>
            u.userPoolId === poolId && u.username.toLowerCase() === needle
        );
    }
    return undefined;
  }

  getUserByUsername(poolId: string, username: string): CognitoUser | undefined {
    // Resolve sign-in alias when pool uses email-as-username
    const pool = this.getPool(poolId);
    if (!pool) return undefined;

    if (pool.usernameAttributes.includes("email") && username.includes("@")) {
      const byEmail = this.getUserByEmail(poolId, username);
      if (byEmail) return byEmail;
    }
    if (pool.usernameAttributes.includes("phone_number")) {
      const byPhone = this.getUserByPhone(poolId, username);
      if (byPhone) return byPhone;
    }
    return this.getUser(poolId, username);
  }

  getUserByEmail(poolId: string, email: string): CognitoUser | undefined {
    const needle = email.toLowerCase();
    return this.users
      .values()
      .find((u) => u.userPoolId === poolId && u.email === needle);
  }

  getUserByPhone(poolId: string, phone: string): CognitoUser | undefined {
    return this.users
      .values()
      .find(
        (u) => u.userPoolId === poolId && u.attributes.phone_number === phone
      );
  }

  getUserBySub(poolId: string, sub: string): CognitoUser | undefined {
    return this.users
      .values()
      .find((u) => u.userPoolId === poolId && u.attributes.sub === sub);
  }

  getUserByRefreshToken(token: string): CognitoUser | undefined {
    return this.users.values().find((u) => u.refreshTokens.includes(token));
  }

  createUser(user: CognitoUser): void {
    this.users.set(this.userKey(user.userPoolId, user.username), {
      ...user,
      email: user.email.toLowerCase(),
      refreshTokens: user.refreshTokens ?? [],
    });
  }

  updateUser(user: CognitoUser): void {
    this.users.set(this.userKey(user.userPoolId, user.username), user);
  }

  deleteUser(poolId: string, username: string): boolean {
    return this.users.delete(this.userKey(poolId, username));
  }

  listUsers(poolId: string, opts: ListUsersOptions = {}): CognitoUser[] {
    let users = this.users.values().filter((u) => u.userPoolId === poolId);

    if (opts.filter) {
      // Bounded character classes prevent catastrophic backtracking on
      // adversarial inputs like `!="!="!="...`.
      const match = opts.filter.match(/^([\w:.-]+)\s*(\^?=)\s*"([^"]+)"$/);
      if (match) {
        const [, attr, op, value] = match;
        users = users.filter((u) => {
          const v = u.attributes[attr] ?? "";
          return op === "=" ? v === value : v.startsWith(value);
        });
      }
    }

    if (opts.limit) users = users.slice(0, opts.limit);
    return users;
  }

  generateUsername(): string {
    return uuidv4();
  }

  generateConfirmationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // -------------------- Refresh-token bookkeeping (#381) --------------------

  recordRefreshTokenForUser(
    poolId: string,
    username: string,
    token: string
  ): void {
    const user = this.getUser(poolId, username);
    if (!user) return;
    user.refreshTokens.push(token);
    this.updateUser(user);
  }

  clearRefreshTokensForUser(poolId: string, username: string): string[] {
    const user = this.getUser(poolId, username);
    if (!user) return [];
    const removed = user.refreshTokens;
    user.refreshTokens = [];
    this.updateUser(user);
    return removed;
  }
}
