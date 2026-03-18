const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    extends: tseslint.configs.recommended,
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: ["dist/", "node_modules/"],
  }
);
