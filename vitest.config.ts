import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    // test/docker/ requires a running container and is run separately via
    // `npm run test:docker` with a different config.
    exclude: ["**/node_modules/**", "test/docker/**"],
    setupFiles: ["test/setup.ts"],
  },
});
