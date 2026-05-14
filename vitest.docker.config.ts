import { defineConfig } from "vitest/config";

/**
 * Vitest config for the docker integration suite.
 *
 * Differences from the default config:
 *   - includes only test/docker/**, never the in-process tests
 *   - no setup file (does not bootstrap an in-process app)
 *   - longer timeouts to accommodate network calls and `docker restart`
 *
 * Invoke via `npm run test:docker` with COGNITO_LOCAL_ENDPOINT set.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/docker/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
