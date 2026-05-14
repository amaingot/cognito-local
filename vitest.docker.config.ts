import { defineConfig } from "vitest/config";

/**
 * Vitest config for the docker integration suite.
 *
 * Differences from the default config:
 *   - includes only test/docker/**, never the in-process tests
 *   - no setup file (does not bootstrap an in-process app)
 *   - longer timeouts to accommodate network calls and `docker restart`
 *   - fileParallelism disabled — there is one shared container and the
 *     persistence tests restart it; running test files in parallel would let
 *     persistence kill smoke's in-flight requests.
 *
 * Invoke via `npm run test:docker` with COGNITO_LOCAL_ENDPOINT set.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/docker/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
