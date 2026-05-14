import { DataStore } from "./store";
import { AppClient, AppConfig } from "../types";

export class ClientStore {
  private clients: DataStore<AppClient>;

  constructor(dataDir: string) {
    this.clients = new DataStore<AppClient>(dataDir, "clients.json");
  }

  initFromConfig(config: AppConfig): void {
    const now = new Date();
    for (const pool of config.pools) {
      for (const c of pool.clients) {
        if (!this.clients.has(c.clientId)) {
          this.clients.set(c.clientId, {
            clientId: c.clientId,
            clientSecret: c.clientSecret,
            clientName: c.clientName,
            userPoolId: pool.id,
            callbackUrls: c.callbackUrls,
            logoutUrls: c.logoutUrls,
            explicitAuthFlows: c.explicitAuthFlows,
            allowedOAuthFlows: c.allowedOAuthFlows,
            allowedOAuthScopes: c.allowedOAuthScopes,
            accessTokenValidity: c.accessTokenValidity ?? 3600,
            idTokenValidity: c.idTokenValidity ?? 3600,
            refreshTokenValidity: c.refreshTokenValidity ?? 30 * 24 * 3600,
            tokenValidityUnits: c.tokenValidityUnits,
            preventUserExistenceErrors: c.preventUserExistenceErrors,
            generateSecret: c.generateSecret,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }
  }

  getClient(clientId: string): AppClient | undefined {
    return this.clients.get(clientId);
  }

  getClientsByPool(poolId: string): AppClient[] {
    return this.clients.values().filter((c) => c.userPoolId === poolId);
  }

  listClients(): AppClient[] {
    return this.clients.values();
  }

  createClient(client: AppClient): void {
    this.clients.set(client.clientId, {
      ...client,
      createdAt: client.createdAt ?? new Date(),
      updatedAt: new Date(),
    });
  }

  updateClient(client: AppClient): void {
    this.clients.set(client.clientId, { ...client, updatedAt: new Date() });
  }

  deleteClient(clientId: string): boolean {
    return this.clients.delete(clientId);
  }
}
