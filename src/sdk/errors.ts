import { Response } from "express";

export function cognitoError(
  res: Response,
  statusCode: number,
  type: string,
  message: string
): void {
  res.status(statusCode).json({ __type: type, message });
}

export function usernameExistsError(
  res: Response,
  message = "User already exists"
): void {
  cognitoError(res, 400, "UsernameExistsException", message);
}

export function userNotFoundError(
  res: Response,
  message = "User does not exist."
): void {
  cognitoError(res, 400, "UserNotFoundException", message);
}

export function notAuthorizedError(
  res: Response,
  message = "Incorrect username or password."
): void {
  cognitoError(res, 400, "NotAuthorizedException", message);
}

export function invalidParameterError(
  res: Response,
  message = "Invalid parameter."
): void {
  cognitoError(res, 400, "InvalidParameterException", message);
}

export function codeMismatchError(
  res: Response,
  message = "Invalid verification code provided, please try again."
): void {
  cognitoError(res, 400, "CodeMismatchException", message);
}

export function expiredCodeError(
  res: Response,
  message = "Invalid code provided, please request a code again."
): void {
  cognitoError(res, 400, "ExpiredCodeException", message);
}

export function resourceNotFoundError(
  res: Response,
  message = "Resource not found."
): void {
  cognitoError(res, 400, "ResourceNotFoundException", message);
}

export function invalidPasswordError(
  res: Response,
  message = "Password did not conform with policy."
): void {
  cognitoError(res, 400, "InvalidPasswordException", message);
}
