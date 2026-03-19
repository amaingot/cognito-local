import { v4 as uuidv4 } from "uuid";
import { DataStore } from "./store";
import { CognitoUser, UserPool, AppConfig, UserConfig } from "../types";

export class UserPoolStore {
  private pools: DataStore<UserPool>;
  private users: DataStore<CognitoUser>;

  constructor(dataDir: string) {
    this.pools = new DataStore<UserPool>(dataDir, "pools.json");
    this.users = new DataStore<CognitoUser>(dataDir, "users.json");
  }

  initFromConfig(config: AppConfig, seedUsers: UserConfig[]): void {
    if (!this.pools.has(config.userPoolId)) {
      this.pools.set(config.userPoolId, {
        id: config.userPoolId,
        name: config.userPoolName,
        region: config.region,
        usernameAttributes: ["email"],
        schema: [
          { name: "email", attributeDataType: "String", required: true, mutable: true },
          { name: "given_name", attributeDataType: "String", required: false, mutable: true },
          { name: "family_name", attributeDataType: "String", required: false, mutable: true },
          { name: "nickname", attributeDataType: "String", required: false, mutable: true },
          { name: "phone_number", attributeDataType: "String", required: false, mutable: true },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    for (const u of seedUsers) {
      const key = `${config.userPoolId}:${u.username}`;
      if (!this.users.has(key)) {
        this.users.set(key, {
          username: u.username,
          email: u.email.toLowerCase(),
          password: u.password,
          attributes: {
            email: u.email.toLowerCase(),
            email_verified: "true",
            sub: u.username,
            ...u.attributes,
          },
          groups: u.groups ?? [],
          status: u.status ?? "CONFIRMED",
          enabled: true,
          userPoolId: config.userPoolId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  getPool(poolId: string): UserPool | undefined {
    return this.pools.get(poolId);
  }

  createPool(pool: UserPool): void {
    this.pools.set(pool.id, pool);
  }

  getUser(poolId: string, username: string): CognitoUser | undefined {
    return this.users.get(`${poolId}:${username}`);
  }

  getUserByEmail(poolId: string, email: string): CognitoUser | undefined {
    return this.users
      .values()
      .find((u) => u.userPoolId === poolId && u.email === email.toLowerCase());
  }

  createUser(user: CognitoUser): void {
    this.users.set(`${user.userPoolId}:${user.username}`, {
      ...user,
      email: user.email.toLowerCase(),
    });
  }

  updateUser(user: CognitoUser): void {
    this.users.set(`${user.userPoolId}:${user.username}`, user);
  }

  deleteUser(poolId: string, username: string): boolean {
    return this.users.delete(`${poolId}:${username}`);
  }

  listUsers(poolId: string, filter?: string): CognitoUser[] {
    let users = this.users
      .values()
      .filter((u) => u.userPoolId === poolId);

    if (filter) {
      const match = filter.match(/^(\w+)\s*=\s*"(.+)"$/);
      if (match) {
        const [, attr, value] = match;
        users = users.filter((u) => u.attributes[attr] === value);
      }
    }

    return users;
  }

  generateUsername(): string {
    return uuidv4();
  }

  generateConfirmationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
