import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightChangelogs from "starlight-changelogs";

export default defineConfig({
  site: "https://amaingot.github.io",
  base: "/cognito-local",
  integrations: [
    starlight({
      title: "cognito-local",
      description:
        "Local emulator for Amazon Cognito authentication services",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/amaingot/cognito-local",
        },
      ],
      plugins: [starlightChangelogs()],
      sidebar: [
        { label: "Getting Started", slug: "getting-started" },
        { label: "Scope & Limitations", slug: "scope" },
        {
          label: "Configuration",
          items: [
            { label: "Overview", slug: "configuration/overview" },
            { label: "Config File", slug: "configuration/config-file" },
            { label: "Users File", slug: "configuration/users-file" },
            {
              label: "Environment Variables",
              slug: "configuration/environment-variables",
            },
            {
              label: "Client Settings",
              slug: "configuration/client-settings",
            },
          ],
        },
        {
          label: "OIDC Endpoints",
          items: [
            { label: "Overview", slug: "oidc/overview" },
            { label: "Discovery & JWKS", slug: "oidc/discovery" },
            { label: "Authorization", slug: "oidc/authorization" },
            { label: "Token Exchange", slug: "oidc/token" },
            { label: "UserInfo", slug: "oidc/userinfo" },
            { label: "Logout & Revocation", slug: "oidc/logout-revoke" },
          ],
        },
        {
          label: "SDK Operations",
          items: [
            { label: "Overview", slug: "sdk/overview" },
            { label: "Authentication", slug: "sdk/authentication" },
            { label: "User Registration", slug: "sdk/registration" },
            { label: "Admin Operations", slug: "sdk/admin-operations" },
            {
              label: "Pool & Client Management",
              slug: "sdk/pool-management",
            },
          ],
        },
        {
          label: "Auth Flows",
          items: [
            {
              label: "USER_PASSWORD_AUTH",
              slug: "auth-flows/user-password-auth",
            },
            {
              label: "REFRESH_TOKEN_AUTH",
              slug: "auth-flows/refresh-token-auth",
            },
            {
              label: "Authorization Code + PKCE",
              slug: "auth-flows/authorization-code-pkce",
            },
            {
              label: "Password Grant (OIDC)",
              slug: "auth-flows/password-grant",
            },
          ],
        },
        {
          label: "Usage Examples",
          items: [
            { label: "Docker & Docker Compose", slug: "examples/docker" },
            { label: "Python (boto3)", slug: "examples/python-boto3" },
            {
              label: "JavaScript (AWS SDK v3)",
              slug: "examples/javascript-sdk",
            },
            { label: "Frontend OIDC Client", slug: "examples/frontend-oidc" },
            {
              label: "Full Auth Code Flow",
              slug: "examples/full-auth-code-flow",
            },
          ],
        },
        {
          label: "Architecture",
          items: [
            { label: "Overview", slug: "architecture/overview" },
            { label: "Data Layer", slug: "architecture/data-layer" },
            { label: "Token Generation", slug: "architecture/tokens" },
            { label: "Crypto & Keys", slug: "architecture/crypto" },
          ],
        },
        {
          label: "Contributing",
          items: [
            {
              label: "Development Setup",
              slug: "contributing/development",
            },
            { label: "Testing", slug: "contributing/testing" },
            {
              label: "Adding SDK Operations",
              slug: "contributing/adding-sdk-operations",
            },
          ],
        },
      ],
    }),
  ],
});
