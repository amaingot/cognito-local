import { DataStore } from "./store";
import { Group } from "../types";

/**
 * GroupStore — groups keyed by `${poolId}:${groupName}`.
 */
export class GroupStore {
  private groups: DataStore<Group>;

  constructor(dataDir: string) {
    this.groups = new DataStore<Group>(dataDir, "groups.json");
  }

  private key(poolId: string, name: string): string {
    return `${poolId}:${name}`;
  }

  getGroup(poolId: string, name: string): Group | undefined {
    return this.groups.get(this.key(poolId, name));
  }

  createGroup(group: Group): void {
    this.groups.set(this.key(group.userPoolId, group.groupName), group);
  }

  updateGroup(group: Group): void {
    this.groups.set(this.key(group.userPoolId, group.groupName), {
      ...group,
      updatedAt: new Date().toISOString(),
    });
  }

  deleteGroup(poolId: string, name: string): boolean {
    return this.groups.delete(this.key(poolId, name));
  }

  listGroupsForPool(poolId: string, limit?: number): Group[] {
    const all = this.groups.values().filter((g) => g.userPoolId === poolId);
    return limit ? all.slice(0, limit) : all;
  }

  listGroupsForUser(poolId: string, internalUsername: string): Group[] {
    return this.groups
      .values()
      .filter(
        (g) =>
          g.userPoolId === poolId && g.members.includes(internalUsername)
      );
  }

  addMember(poolId: string, name: string, internalUsername: string): boolean {
    const group = this.getGroup(poolId, name);
    if (!group) return false;
    if (!group.members.includes(internalUsername)) {
      group.members.push(internalUsername);
      this.updateGroup(group);
    }
    return true;
  }

  removeMember(
    poolId: string,
    name: string,
    internalUsername: string
  ): boolean {
    const group = this.getGroup(poolId, name);
    if (!group) return false;
    const idx = group.members.indexOf(internalUsername);
    if (idx === -1) return true;
    group.members.splice(idx, 1);
    this.updateGroup(group);
    return true;
  }

  listMembers(poolId: string, name: string): string[] {
    const group = this.getGroup(poolId, name);
    return group ? [...group.members] : [];
  }
}
