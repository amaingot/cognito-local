import { DataStore } from "./store";
import { AppClient, AppConfig } from "../types";

export class ClientStore {
  private clients: DataStore<AppClient>;

  constructor(dataDir: string) {
    this.clients = new DataStore<AppClient>(dataDir, "clients.json");
  }

  initFromConfig(config: AppConfig): void {
    for (const c of config.clients) {
      if (!this.clients.has(c.clientId)) {
        this.clients.set(c.clientId, {
          clientId: c.clientId,
          clientSecret: c.clientSecret,
          clientName: c.clientName,
          userPoolId: config.userPoolId,
          callbackUrls: c.callbackUrls,
          logoutUrls: c.logoutUrls,
          explicitAuthFlows: c.explicitAuthFlows,
          allowedOAuthFlows: c.allowedOAuthFlows,
          allowedOAuthScopes: c.allowedOAuthScopes,
          accessTokenValidity: c.accessTokenValidity ?? 3600,
          idTokenValidity: c.idTokenValidity ?? 3600,
          refreshTokenValidity: c.refreshTokenValidity ?? 30 * 24 * 3600,
        });
      }
    }
  }

  getClient(clientId: string): AppClient | undefined {
    return this.clients.get(clientId);
  }

  getClientsByPool(poolId: string): AppClient[] {
    return this.clients.values().filter((c) => c.userPoolId === poolId);
  }

  createClient(client: AppClient): void {
    this.clients.set(client.clientId, client);
  }

  deleteClient(clientId: string): boolean {
    return this.clients.delete(clientId);
  }
}
