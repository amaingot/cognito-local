/**
 * Docker persistence tests — verifies that data survives a container restart.
 *
 * This is the part the in-process tests can't cover: real Cognito users
 * mount a volume at DATA_DIR (/temp-data by default) and expect users,
 * groups, clients, and refresh tokens to all survive `docker restart`.
 *
 * Each test creates an entity, restarts the container, and then re-queries.
 * If a test fails here, `docker logs $DOCKER_CONTAINER_NAME` is the first
 * place to look — the CI workflow always dumps it on failure.
 */

import { describe, it, expect } from "vitest";
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminInitiateAuthCommand,
  AdminListGroupsForUserCommand,
  AdminUpdateUserAttributesCommand,
  CreateGroupCommand,
  GetGroupCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  CONTAINER_NAME,
  DOCKER_CLIENT_ID,
  DOCKER_POOL_ID,
  makeClient,
  restartContainer,
} from "./_helpers";

// Skip the entire suite if no container name is available (e.g., someone runs
// `npm run test:docker` against a non-container endpoint).
describe.skipIf(!CONTAINER_NAME)("docker persistence", () => {
  it("a created user survives a container restart", async () => {
    const c = makeClient();
    const email = `persist-user-${Date.now()}@example.com`;
    await c.send(
      new AdminCreateUserCommand({
        UserPoolId: DOCKER_POOL_ID,
        Username: email,
        UserAttributes: [{ Name: "email", Value: email }],
        TemporaryPassword: "TempPass1!",
      })
    );

    await restartContainer();

    const fetched = await c.send(
      new AdminGetUserCommand({
        UserPoolId: DOCKER_POOL_ID,
        Username: email,
      })
    );
    expect(fetched.Username).toBeTruthy();
    expect(fetched.UserStatus).toBe("FORCE_CHANGE_PASSWORD");
    const emailAttr = fetched.UserAttributes?.find((a) => a.Name === "email");
    expect(emailAttr?.Value).toBe(email);
  });

  it("a group + group membership survive a container restart", async () => {
    const c = makeClient();
    const groupName = `persist-group-${Date.now()}`;
    const email = `persist-grp-user-${Date.now()}@example.com`;

    // Create user and group, add user to group
    await c.send(
      new AdminCreateUserCommand({
        UserPoolId: DOCKER_POOL_ID,
        Username: email,
        UserAttributes: [{ Name: "email", Value: email }],
        TemporaryPassword: "TempPass1!",
      })
    );
    await c.send(
      new CreateGroupCommand({
        UserPoolId: DOCKER_POOL_ID,
        GroupName: groupName,
        Description: "Persistence test",
      })
    );
    await c.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: DOCKER_POOL_ID,
        Username: email,
        GroupName: groupName,
      })
    );

    await restartContainer();

    const group = await c.send(
      new GetGroupCommand({
        UserPoolId: DOCKER_POOL_ID,
        GroupName: groupName,
      })
    );
    expect(group.Group?.GroupName).toBe(groupName);
    expect(group.Group?.Description).toBe("Persistence test");

    const membership = await c.send(
      new AdminListGroupsForUserCommand({
        UserPoolId: DOCKER_POOL_ID,
        Username: email,
      })
    );
    const names = membership.Groups?.map((g) => g.GroupName) ?? [];
    expect(names).toContain(groupName);
  });

  it("a refresh token still works after a container restart", async () => {
    const c = makeClient();
    const email = `persist-refresh-${Date.now()}@example.com`;
    await c.send(
      new AdminCreateUserCommand({
        UserPoolId: DOCKER_POOL_ID,
        Username: email,
        UserAttributes: [{ Name: "email", Value: email }],
        TemporaryPassword: "TempPass1!",
      })
    );

    // Complete the NEW_PASSWORD_REQUIRED flow so we have a usable refresh token.
    // FORCE_CHANGE_PASSWORD users go through the admin auth flow to get a session.
    const challenge = await c.send(
      new AdminInitiateAuthCommand({
        UserPoolId: DOCKER_POOL_ID,
        ClientId: DOCKER_CLIENT_ID,
        AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
        AuthParameters: { USERNAME: email, PASSWORD: "TempPass1!" },
      })
    );
    const final = await c.send(
      new RespondToAuthChallengeCommand({
        ClientId: DOCKER_CLIENT_ID,
        ChallengeName: "NEW_PASSWORD_REQUIRED",
        Session: challenge.Session!,
        ChallengeResponses: {
          USERNAME: email,
          NEW_PASSWORD: "FinalPass1!",
        },
      })
    );
    const refresh = final.AuthenticationResult!.RefreshToken!;

    await restartContainer();

    const refreshed = await c.send(
      new InitiateAuthCommand({
        AuthFlow: "REFRESH_TOKEN_AUTH",
        ClientId: DOCKER_CLIENT_ID,
        AuthParameters: { REFRESH_TOKEN: refresh },
      })
    );
    expect(refreshed.AuthenticationResult?.AccessToken).toBeTruthy();
    expect(refreshed.AuthenticationResult?.IdToken).toBeTruthy();
  });

  it("user attribute updates survive a container restart", async () => {
    const c = makeClient();
    const email = `persist-attrs-${Date.now()}@example.com`;
    await c.send(
      new AdminCreateUserCommand({
        UserPoolId: DOCKER_POOL_ID,
        Username: email,
        UserAttributes: [{ Name: "email", Value: email }],
        TemporaryPassword: "TempPass1!",
      })
    );
    await c.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: DOCKER_POOL_ID,
        Username: email,
        UserAttributes: [
          { Name: "given_name", Value: "Persistence" },
          { Name: "family_name", Value: "Survivor" },
        ],
      })
    );

    await restartContainer();

    const fetched = await c.send(
      new AdminGetUserCommand({
        UserPoolId: DOCKER_POOL_ID,
        Username: email,
      })
    );
    const attrMap = Object.fromEntries(
      (fetched.UserAttributes ?? []).map((a) => [a.Name, a.Value])
    );
    expect(attrMap.given_name).toBe("Persistence");
    expect(attrMap.family_name).toBe("Survivor");
  });
});
