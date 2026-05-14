export class CognitoError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.name = code;
    this.code = code;
    this.httpStatus = httpStatus;
  }

  toResponseBody(): { __type: string; message: string } {
    return { __type: this.code, message: this.message };
  }
}

export class NotAuthorizedError extends CognitoError {
  constructor(message = "Incorrect username or password.") {
    super("NotAuthorizedException", message);
  }
}

export class UserNotFoundError extends CognitoError {
  constructor(message = "User does not exist.") {
    super("UserNotFoundException", message);
  }
}

export class UsernameExistsError extends CognitoError {
  constructor(message = "User already exists") {
    super("UsernameExistsException", message);
  }
}

export class InvalidParameterError extends CognitoError {
  constructor(message = "Invalid parameter.") {
    super("InvalidParameterException", message);
  }
}

export class InvalidPasswordError extends CognitoError {
  constructor(message = "Password did not conform with policy.") {
    super("InvalidPasswordException", message);
  }
}

export class CodeMismatchError extends CognitoError {
  constructor(
    message = "Invalid verification code provided, please try again."
  ) {
    super("CodeMismatchException", message);
  }
}

export class ExpiredCodeError extends CognitoError {
  constructor(message = "Invalid code provided, please request a code again.") {
    super("ExpiredCodeException", message);
  }
}

export class ResourceNotFoundError extends CognitoError {
  constructor(message = "Resource not found.") {
    super("ResourceNotFoundException", message);
  }
}

export class UserNotConfirmedError extends CognitoError {
  constructor(message = "User is not confirmed.") {
    super("UserNotConfirmedException", message);
  }
}

export class PasswordResetRequiredError extends CognitoError {
  constructor(message = "Password reset required for the user.") {
    super("PasswordResetRequiredException", message);
  }
}

export class TooManyRequestsError extends CognitoError {
  constructor(message = "Too many requests.") {
    super("TooManyRequestsException", message, 429);
  }
}

export class LimitExceededError extends CognitoError {
  constructor(message = "Attempt limit exceeded, please try after some time.") {
    super("LimitExceededException", message);
  }
}

export class AliasExistsError extends CognitoError {
  constructor(message = "An account with the given email already exists.") {
    super("AliasExistsException", message);
  }
}

export class InvalidLambdaResponseError extends CognitoError {
  constructor(message = "Lambda returned an invalid response.") {
    super("InvalidLambdaResponseException", message);
  }
}

export class UnexpectedLambdaException extends CognitoError {
  constructor(message = "Lambda threw an unexpected exception.") {
    super("UnexpectedLambdaException", message);
  }
}

export class UserLambdaValidationError extends CognitoError {
  constructor(message = "User lambda validation failed.") {
    super("UserLambdaValidationException", message);
  }
}

export class GroupExistsError extends CognitoError {
  constructor(message = "Group already exists.") {
    super("GroupExistsException", message);
  }
}

export class ConcurrentModificationError extends CognitoError {
  constructor(message = "Concurrent modification.") {
    super("ConcurrentModificationException", message);
  }
}

export class UnsupportedError extends CognitoError {
  constructor(operation: string) {
    super(
      "CognitoLocal#Unsupported",
      `Cognito Local does not yet support ${operation}`,
      500
    );
  }
}

export class MfaMethodNotFoundError extends CognitoError {
  constructor(message = "User has not enabled MFA.") {
    super("MFAMethodNotFoundException", message);
  }
}

export class EnableSoftwareTokenMfaError extends CognitoError {
  constructor(message = "Could not enable software token MFA.") {
    super("EnableSoftwareTokenMFAException", message);
  }
}

export class SoftwareTokenMfaNotFoundError extends CognitoError {
  constructor(message = "Software token MFA is not configured for user.") {
    super("SoftwareTokenMFANotFoundException", message);
  }
}
