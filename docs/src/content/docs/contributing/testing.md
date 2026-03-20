---
title: Testing
description: How to run and write tests for cognito-local, including the test setup, constants, cleanup, and conventions.
---

## Test Framework

Tests use [vitest](https://vitest.dev/) with [supertest](https://github.com/ladjs/supertest) for HTTP assertions.

## Running Tests

```bash
npm test                                    # Run all tests
npm run test:watch                          # Watch mode
npx vitest run test/sdk/sign-up.test.ts     # Single file
```

## Test Setup (`test/setup.ts`)

The `createTestApp()` function creates an isolated app instance for each test:

1. Creates a temporary data directory in the OS temp folder.
2. Generates fresh RSA keys.
3. Initializes stores (`UserPoolStore`, `ClientStore`, `TokenStore`).
4. Seeds two test users:
   - `test-user-1` / `test@example.com` -- status `CONFIRMED`, member of `"TestGroup"`
   - `test-user-2` / `unconfirmed@example.com` -- status `UNCONFIRMED`, confirmation code `"123456"`
5. Creates the Express app with the test context.

## Test Constants

```typescript
TEST_POOL_ID = "us-east-1_testPool"
TEST_CLIENT_ID = "test-client"
TEST_CLIENT_SECRET = "test-secret"
TEST_ISSUER_HOST = "http://localhost:9229"
```

These constants are exported from `test/setup.ts` and should be used in all tests to ensure consistency.

## Cleanup

An `afterEach` hook automatically:

- Destroys `TokenStore` instances (clears cleanup timers to prevent test leaks).
- Removes temporary data directories.

You do not need to add cleanup logic to individual tests.

## Writing a Test

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestApp, TEST_CLIENT_ID } from "../setup";

describe("MyOperation", () => {
  it("should do something", async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .post("/")
      .set("Content-Type", "application/x-amz-json-1.1")
      .set(
        "X-Amz-Target",
        "AWSCognitoIdentityProviderService.MyOperation"
      )
      .send({ ClientId: TEST_CLIENT_ID /* ... */ });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      /* expected response */
    });
  });
});
```

## Test Structure

- `test/sdk/` -- One file per SDK operation or group of related operations (e.g., `sign-up.test.ts`, `initiate-auth.test.ts`, `admin-user.test.ts`).
- `test/oidc/` -- One file per OIDC endpoint (e.g., `discovery.test.ts`, `token.test.ts`, `userinfo.test.ts`).
- `test/integration/` -- Full auth flow tests that exercise multiple endpoints together (e.g., `full-flow.test.ts`).

## Conventions

- Each test should call `createTestApp()` to get a fresh, isolated app instance. Do not share app instances between tests.
- Use the pre-seeded test users when you need existing users rather than creating new ones in every test.
- Test both success paths and error paths. At minimum, verify that missing required parameters return the appropriate error response.
- Use the test constants (`TEST_POOL_ID`, `TEST_CLIENT_ID`, etc.) rather than hardcoding values.
