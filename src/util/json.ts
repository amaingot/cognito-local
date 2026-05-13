const DATE_KEY_PATTERN =
  /(?:Date|date|CreatedAt|createdAt|UpdatedAt|updatedAt|LastModifiedAt|lastModifiedAt|ModifiedDate|StartDate|CompletionDate)$/;

function isIsoLike(s: string): boolean {
  // Quick reject for non-iso strings
  return /^\d{4}-\d{2}-\d{2}T/.test(s);
}

/**
 * JSON replacer for the Cognito wire format. Real Amazon Cognito returns
 * timestamps as Unix epoch seconds (integers). The replacer converts:
 *  - `Date` instances → unix seconds
 *  - ISO-8601 string values for keys ending in `Date` (e.g. CreationDate,
 *    LastModifiedDate, UserCreateDate) → unix seconds. This catches handlers
 *    that store dates as strings internally.
 */
export const cognitoJsonReplacer = function (
  this: Record<string, unknown>,
  key: string,
  value: unknown
): unknown {
  const raw = this[key];
  if (raw instanceof Date) {
    return Math.floor(raw.getTime() / 1000);
  }
  if (
    typeof raw === "string" &&
    DATE_KEY_PATTERN.test(key) &&
    isIsoLike(raw)
  ) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return Math.floor(d.getTime() / 1000);
    }
  }
  return value;
};

export function stringifyCognito(value: unknown): string {
  return JSON.stringify(value, cognitoJsonReplacer);
}
