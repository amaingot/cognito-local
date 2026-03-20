---
title: "Frontend OIDC Client"
description: "How to configure frontend OIDC libraries like react-oidc-context and oidc-client-ts to authenticate against cognito-local."
---

cognito-local implements a standard OIDC discovery endpoint, so most frontend OIDC libraries work out of the box with minimal configuration.

## Common settings

These are the key configuration values for any OIDC library:

| Setting | Value |
|---|---|
| Authority / Issuer | `http://localhost:9229/us-east-1_localDev01` |
| Client ID | Your configured client ID (e.g., `my-app-local`) |
| Redirect URI | Must match one of the client's `callbackUrls` |
| Scope | `openid email profile` |
| Response type | `code` |

The authority URL includes the user pool ID as a path segment, matching the format used by real AWS Cognito.

## react-oidc-context

[react-oidc-context](https://github.com/authts/react-oidc-context) provides React hooks for OIDC authentication built on top of oidc-client-ts.

```bash
npm install react-oidc-context oidc-client-ts
```

```tsx
import { AuthProvider, useAuth } from "react-oidc-context";

const oidcConfig = {
  authority: "http://localhost:9229/us-east-1_localDev01",
  client_id: "my-app-local",
  redirect_uri: "http://localhost:3000/callback",
  scope: "openid email profile",
};

function App() {
  return (
    <AuthProvider {...oidcConfig}>
      <YourApp />
    </AuthProvider>
  );
}

function YourApp() {
  const auth = useAuth();

  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (auth.error) {
    return <div>Error: {auth.error.message}</div>;
  }

  if (auth.isAuthenticated) {
    return (
      <div>
        <p>Welcome, {auth.user?.profile.email}</p>
        <button onClick={() => auth.removeUser()}>Log out</button>
      </div>
    );
  }

  return <button onClick={() => auth.signinRedirect()}>Log in</button>;
}
```

## oidc-client-ts

[oidc-client-ts](https://github.com/authts/oidc-client-ts) is a lower-level TypeScript library for OIDC/OAuth2.

```bash
npm install oidc-client-ts
```

```typescript
import { UserManager } from "oidc-client-ts";

const userManager = new UserManager({
  authority: "http://localhost:9229/us-east-1_localDev01",
  client_id: "my-app-local",
  redirect_uri: "http://localhost:3000/callback",
  scope: "openid email profile",
});

// Start login -- redirects the browser to cognito-local's login page
await userManager.signinRedirect();

// Handle callback (on your /callback page)
const user = await userManager.signinRedirectCallback();
console.log(user.profile); // { sub, email, cognito:groups, ... }
```

### Handling the callback

On your callback page (e.g., `/callback`), call `signinRedirectCallback()` to complete the flow:

```typescript
// callback.ts
import { UserManager } from "oidc-client-ts";

const userManager = new UserManager({
  authority: "http://localhost:9229/us-east-1_localDev01",
  client_id: "my-app-local",
  redirect_uri: "http://localhost:3000/callback",
  scope: "openid email profile",
});

async function handleCallback() {
  try {
    const user = await userManager.signinRedirectCallback();
    console.log("Logged in as:", user.profile.email);
    // Redirect to the main app
    window.location.href = "/";
  } catch (err) {
    console.error("Callback error:", err);
  }
}

handleCallback();
```

## About the login page

Unlike real AWS Cognito, cognito-local's login page does **not** require a password. Instead, it shows a **user picker** listing all users in the user pool. Click the user you want to log in as, and you are immediately redirected back to your application with an authorization code.

This design makes testing fast -- there is no need to remember or type passwords during development.

## Tips

### Public clients (SPAs)

For single-page applications, configure the app client in your `config.json` without a `clientSecret`. This makes it a public client, which is the correct setup for browser-based apps that cannot securely store a secret.

```json
{
  "clients": [
    {
      "clientId": "my-spa-client",
      "clientName": "My SPA",
      "callbackUrls": ["http://localhost:3000/callback"],
      "logoutUrls": ["http://localhost:3000"]
    }
  ]
}
```

### PKCE support

PKCE (Proof Key for Code Exchange) is fully supported and recommended for all clients, especially public clients. Most OIDC libraries enable PKCE by default when using the authorization code flow.

### Discovery endpoint

The OpenID Connect discovery endpoint at `/.well-known/openid-configuration` is served under the user pool path:

```
http://localhost:9229/us-east-1_localDev01/.well-known/openid-configuration
```

Most OIDC libraries automatically fetch this document when you provide the `authority` URL. It advertises the authorization, token, userinfo, and JWKS endpoints.

### Switching between local and production

A common pattern is to set the OIDC authority based on an environment variable:

```typescript
const oidcConfig = {
  authority: process.env.REACT_APP_OIDC_AUTHORITY
    || "http://localhost:9229/us-east-1_localDev01",
  client_id: process.env.REACT_APP_CLIENT_ID || "my-app-local",
  redirect_uri: `${window.location.origin}/callback`,
  scope: "openid email profile",
};
```

This way, the same code works against cognito-local in development and real Cognito in production.
