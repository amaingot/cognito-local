import { execFileSync } from "node:child_process";
import {
  CognitoIdentityProviderClient,
  type CognitoIdentityProviderClientConfig,
} from "@aws-sdk/client-cognito-identity-provider";

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
 * Restart the docker container and wait until /health is green again.
 *
 * Uses execFileSync (no shell) — the container name is passed as a discrete
 * argv element, so it cannot be interpolated into a shell command.
 *
 * Requires `DOCKER_CONTAINER_NAME` to be set; throws otherwise so persistence
 * tests fail loudly rather than silently passing.
 */
export async function restartContainer(): Promise<void> {
  if (!CONTAINER_NAME) {
    throw new Error(
      "DOCKER_CONTAINER_NAME is required for persistence tests"
    );
  }
  execFileSync("docker", ["restart", CONTAINER_NAME], { stdio: "pipe" });
  await waitForHealth(30_000);
}
