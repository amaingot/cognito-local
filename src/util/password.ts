import { InvalidPasswordError } from "../errors";
import { PasswordPolicy } from "../types";

export function validatePassword(
  password: string,
  policy: PasswordPolicy
): void {
  if (password.length < policy.minimumLength) {
    throw new InvalidPasswordError(
      `Password did not conform with policy: Password must be at least ${policy.minimumLength} characters.`
    );
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    throw new InvalidPasswordError(
      "Password did not conform with policy: Password must have uppercase characters."
    );
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    throw new InvalidPasswordError(
      "Password did not conform with policy: Password must have lowercase characters."
    );
  }
  if (policy.requireNumbers && !/\d/.test(password)) {
    throw new InvalidPasswordError(
      "Password did not conform with policy: Password must have numeric characters."
    );
  }
  if (
    policy.requireSymbols &&
    !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(password)
  ) {
    throw new InvalidPasswordError(
      "Password did not conform with policy: Password must have symbol characters."
    );
  }
}
