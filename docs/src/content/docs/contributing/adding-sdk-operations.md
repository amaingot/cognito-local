---
title: Adding SDK Operations
description: Step-by-step guide to adding a new Cognito SDK operation to cognito-local, including handler creation, router registration, and testing.
---

This guide walks through adding a new Cognito SDK operation to cognito-local.

## Step 1: Create the Handler

Create a new file at `src/sdk/handlers/{operation-name}.ts`:

```typescript
import { Request, Response } from "express";
import { AppContext } from "../../index";
import { invalidParameterError } from "../errors";

export function myOperationHandler(ctx: AppContext) {
  return (req: Request, res: Response): void => {
    const { RequiredParam } = req.body;

    if (!RequiredParam) {
      invalidParameterError(res, "RequiredParam is required.");
      return;
    }

    // Implementation...

    res.json({
      /* response */
    });
  };
}
```

Key patterns to follow:

- The handler is a **factory function** that receives `AppContext` and returns an Express request handler.
- Use the error helpers from `src/sdk/errors.ts` for Cognito-compatible error responses.
- Access stores via `ctx.userPoolStore`, `ctx.clientStore`, and `ctx.tokenStore`.
- Access configuration via `ctx.config`.

### Available Error Helpers

| Helper | Exception Type |
|--------|---------------|
| `invalidParameterError(res, message)` | `InvalidParameterException` |
| `userNotFoundError(res, message?)` | `UserNotFoundException` |
| `notAuthorizedError(res, message?)` | `NotAuthorizedException` |
| `usernameExistsError(res, message?)` | `UsernameExistsException` |
| `resourceNotFoundError(res, message?)` | `ResourceNotFoundException` |
| `codeMismatchError(res, message?)` | `CodeMismatchException` |

These helpers set the appropriate HTTP status code and return a JSON body with a `__type` field matching the Cognito exception name.

## Step 2: Register in the Router

Add the import and handler registration in `src/sdk/router.ts`:

```typescript
import { myOperationHandler } from "./handlers/my-operation";

// Inside createSdkRouter:
const handlers: Record<string, ...> = {
  // ... existing handlers
  MyOperation: myOperationHandler(ctx),
};
```

The key in the handlers record must match the operation name as it appears in the `X-Amz-Target` header. For example, a request with `X-Amz-Target: AWSCognitoIdentityProviderService.MyOperation` will be dispatched to the handler registered under the key `MyOperation`.

## Step 3: Add Tests

Create `test/sdk/my-operation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import {
  createTestApp,
  TEST_POOL_ID,
  TEST_CLIENT_ID,
} from "../setup";

describe("MyOperation", () => {
  it("should handle the operation", async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .post("/")
      .set("Content-Type", "application/x-amz-json-1.1")
      .set(
        "X-Amz-Target",
        "AWSCognitoIdentityProviderService.MyOperation"
      )
      .send({
        /* request body */
      });

    expect(res.status).toBe(200);
  });

  it("should return error for missing params", async () => {
    const { app } = createTestApp();

    const res = await request(app)
      .post("/")
      .set("Content-Type", "application/x-amz-json-1.1")
      .set(
        "X-Amz-Target",
        "AWSCognitoIdentityProviderService.MyOperation"
      )
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.__type).toBe("InvalidParameterException");
  });
});
```

## Tips

- **Check the AWS documentation.** Refer to the real [Amazon Cognito API reference](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/) for the expected request and response format of the operation you are implementing.
- **Use `createTestApp()` for isolation.** Each call returns a fresh app instance with its own data directory, so tests do not interfere with each other.
- **Test both success and error paths.** At minimum, verify that the operation succeeds with valid input and returns the correct error when required parameters are missing.
- **Use the pre-seeded test users.** The test setup creates two users (`test-user-1` and `test-user-2`) that you can use for operations that require existing user accounts.
- **Follow existing handler patterns.** Look at existing handlers in `src/sdk/handlers/` for examples of how to structure validation, store interaction, and response formatting.
