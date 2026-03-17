import { CognitoUser } from "../types";

export function renderLoginPage(
  users: CognitoUser[],
  hiddenParams: Record<string, string | undefined>
): string {
  const hiddenFields = Object.entries(hiddenParams)
    .filter(([, v]) => v != null)
    .map(
      ([k, v]) =>
        `<input type="hidden" name="${k}" value="${v!.toString().replace(/"/g, "&quot;")}" />`
    )
    .join("\n");

  const userButtons = users
    .map(
      (u) => `
      <button type="submit" name="userId" value="${u.username}" class="user-card">
        <div class="avatar">${(u.attributes.name || u.email).charAt(0).toUpperCase()}</div>
        <div class="info">
          <div class="name">${u.attributes.name || u.email}</div>
          <div class="email">${u.email}</div>
          <div class="groups">${u.groups.join(", ")}</div>
        </div>
      </button>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head>
  <title>Cognito Local - Login</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #f8f9fa; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { max-width: 480px; width: 100%; padding: 24px; }
    h2 { color: #333; margin-bottom: 4px; font-size: 22px; }
    .subtitle { color: #868e96; margin-bottom: 20px; font-size: 14px; }
    form { display: flex; flex-direction: column; gap: 8px; }
    .user-card { display: flex; align-items: center; gap: 14px; padding: 12px 16px; background: white; border: 1px solid #dee2e6; border-radius: 8px; cursor: pointer; text-align: left; font: inherit; transition: all 0.15s; }
    .user-card:hover { border-color: #228be6; background: #f1f6ff; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; background: #228be6; color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 16px; flex-shrink: 0; }
    .info { min-width: 0; }
    .name { font-weight: 600; color: #212529; font-size: 14px; }
    .email { color: #868e96; font-size: 13px; }
    .groups { color: #adb5bd; font-size: 12px; margin-top: 1px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Cognito Local - Login</h2>
    <p class="subtitle">Click a user to sign in</p>
    <form method="post" action="/oauth2/authorize/callback">
      ${hiddenFields}
      ${userButtons}
    </form>
  </div>
</body>
</html>`;
}
