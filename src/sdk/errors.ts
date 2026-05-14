/**
 * Backwards-compat shims that throw the new error classes from src/errors.ts.
 * New handlers should `throw new XxxError(...)` directly.
 */
import type { Response } from "express";
import {
  CodeMismatchError,
  ExpiredCodeError,
  InvalidParameterError,
  InvalidPasswordError,
  NotAuthorizedError,
  ResourceNotFoundError,
  UserNotFoundError,
  UsernameExistsError,
} from "../errors";

export {
  CodeMismatchError,
  ExpiredCodeError,
  InvalidParameterError,
  InvalidPasswordError,
  NotAuthorizedError,
  ResourceNotFoundError,
  UserNotFoundError,
  UsernameExistsError,
} from "../errors";

export function usernameExistsError(
  _res: Response,
  message?: string
): never {
  throw new UsernameExistsError(message);
}

export function userNotFoundError(_res: Response, message?: string): never {
  throw new UserNotFoundError(message);
}

export function notAuthorizedError(_res: Response, message?: string): never {
  throw new NotAuthorizedError(message);
}

export function invalidParameterError(
  _res: Response,
  message?: string
): never {
  throw new InvalidParameterError(message);
}

export function codeMismatchError(_res: Response, message?: string): never {
  throw new CodeMismatchError(message);
}

export function expiredCodeError(_res: Response, message?: string): never {
  throw new ExpiredCodeError(message);
}

export function resourceNotFoundError(
  _res: Response,
  message?: string
): never {
  throw new ResourceNotFoundError(message);
}

export function invalidPasswordError(
  _res: Response,
  message?: string
): never {
  throw new InvalidPasswordError(message);
}
