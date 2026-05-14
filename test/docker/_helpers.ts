import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  CognitoIdentityProviderClient,
  type CognitoIdentityProviderClientConfig,
} from "@aws-sdk/client-cognito-identity-provider";

const execFileAsync = promisify(execFile);

/**
 * Pool and client IDs from config/config.example.json — the file mounted into
 * the container in CI.
 */
export const DOCKER_POOL_ID = "us-east-1_localDev01";
export const DOCKER_CLIENT_ID = "my-app-local";

/**
 * Pre-seeded user from config/users.example.json.
 */
export const SEED_USER_EMAIL = "alice@example.com";
export const SEED_USER_PASSWORD = "Password1!";

export const ENDPOINT = (() => {
  const v = process.env.COGNITO_LOCAL_ENDPOINT;
  if (!v) {
    throw new Error(
      "COGNITO_LOCAL_ENDPOINT is required for docker integration tests " +
        "(e.g. http://localhost:9229). These tests must run against a live " +
        "container; do not invoke them from `npm test`."
    );
  }
  return v;
})();

export const CONTAINER_NAME = process.env.DOCKER_CONTAINER_NAME;

/**
 * Build a Cognito SDK client pointed at the docker container.
 */
export function makeClient(
  overrides: Partial<CognitoIdentityProviderClientConfig> = {}
): CognitoIdentityProviderClient {
  return new CognitoIdentityProviderClient({
    region: "us-east-1",
    endpoint: ENDPOINT,
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
    ...overrides,
  });
}

/**
 * Poll /health until it returns 200, or throw after `timeoutMs`.
 */
export async function waitForHealth(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${ENDPOINT}/health`);
      if (res.ok) {
        return;
      }
      lastErr = new Error(`/health returned ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `Timed out waiting for ${ENDPOINT}/health to return 200 after ${timeoutMs}ms. Last error: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`
  );
}

/**
 * Restart the docker container, wait until /health is green again, and return
 * a fresh SDK client.
 *
 * We pass `-t 1` so docker SIGKILLs after 1 second if the app hasn't already
 * exited on SIGTERM. The server traps SIGTERM and exits cleanly in well under
 * a second, so 1s is comfortable headroom. (Without `-t`, docker uses 10s by
 * default — usable, but slow enough that tests bump up against the 60s vitest
 * timeout, and CI saw the first persistence test hang at exactly 60s.)
 *
 * We destroy the old client and return a fresh one. The AWS SDK keeps an HTTP
 * keep-alive pool, and after a restart pooled sockets point at a process that
 * no longer exists — returning a fresh client makes that impossible.
 *
 * Uses execFile (no shell) — the container name is passed as a discrete argv
 * element so it cannot be interpolated. Async to avoid blocking the Node
 * event loop while docker waits for the container to shut down.
 *
 * Requires `DOCKER_CONTAINER_NAME`; throws otherwise so persistence tests fail
 * loudly rather than silently passing.
 */
export async function restartContainer(
  oldClient?: CognitoIdentityProviderClient
): Promise<CognitoIdentityProviderClient> {
  if (!CONTAINER_NAME) {
    throw new Error(
      "DOCKER_CONTAINER_NAME is required for persistence tests"
    );
  }
  const t0 = Date.now();
  // eslint-disable-next-line no-console
  const log = (msg: string): void =>
    console.log(`[restart +${Date.now() - t0}ms] ${msg}`);
  if (oldClient) {
    log("destroying old client");
    oldClient.destroy();
  }
  log("docker restart starting");
  await execFileAsync("docker", ["restart", "-t", "1", CONTAINER_NAME]);
  log("docker restart returned");
  await waitForHealth(30_000);
  log("waitForHealth returned");
  const fresh = makeClient();
  log("returning fresh client");
  return fresh;
}
