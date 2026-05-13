import { Logger } from "../util/logger";
import { TriggerInvoker } from "../services/lambda";
import {
  PoolConfig,
  PoolTriggerConfig,
  TriggerDef,
  UserPool,
} from "../types";

export type TriggerName = keyof PoolTriggerConfig;

/**
 * TriggerService — invokes pool-scoped Lambda triggers (fixes upstream #464).
 * Each pool can define its own triggers via `pool.triggers.<name>`.
 */
export class TriggerService {
  constructor(
    private invoker: TriggerInvoker,
    private logger: Logger,
    private poolTriggers: Map<string, PoolTriggerConfig>
  ) {}

  static fromPools(
    invoker: TriggerInvoker,
    logger: Logger,
    pools: PoolConfig[]
  ): TriggerService {
    const m = new Map<string, PoolTriggerConfig>();
    for (const p of pools) {
      if (p.triggers) m.set(p.id, p.triggers);
    }
    return new TriggerService(invoker, logger, m);
  }

  enabled(pool: UserPool | string, name: TriggerName): boolean {
    const poolId = typeof pool === "string" ? pool : pool.id;
    const cfg = this.poolTriggers.get(poolId);
    return Boolean(cfg && cfg[name]);
  }

  setPoolTriggers(poolId: string, triggers?: PoolTriggerConfig): void {
    if (triggers) this.poolTriggers.set(poolId, triggers);
    else this.poolTriggers.delete(poolId);
  }

  async fire<TEvent extends Record<string, unknown>>(
    pool: UserPool | string,
    name: TriggerName,
    event: TEvent
  ): Promise<Record<string, unknown> | null> {
    const poolId = typeof pool === "string" ? pool : pool.id;
    const cfg = this.poolTriggers.get(poolId);
    const def: TriggerDef | undefined = cfg?.[name];
    if (!def) return null;
    this.logger.info({ poolId, name }, "Firing Lambda trigger");
    try {
      return await this.invoker.invoke(def, event);
    } catch (err) {
      this.logger.error({ err, name, poolId }, "Trigger invocation failed");
      throw err;
    }
  }
}

/**
 * Builds the Lambda event envelope common to all triggers.
 */
export function triggerEvent(opts: {
  triggerSource: string;
  userPoolId: string;
  username: string;
  region: string;
  clientId?: string;
  userAttributes?: Record<string, string>;
  request?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    version: "1",
    region: opts.region,
    userPoolId: opts.userPoolId,
    triggerSource: opts.triggerSource,
    userName: opts.username,
    callerContext: {
      awsSdkVersion: "cognito-local",
      clientId: opts.clientId ?? "ANONYMOUS",
    },
    request: {
      userAttributes: opts.userAttributes ?? {},
      ...(opts.request ?? {}),
    },
    response: {},
  };
}
