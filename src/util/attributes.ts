import { CognitoUser, SchemaAttribute, UserPool } from "../types";
import { InvalidParameterError } from "../errors";

/**
 * Convert Cognito's wire format (array of {Name, Value}) to a record.
 */
export function attributesArrayToRecord(
  attrs: { Name: string; Value: string }[] | undefined
): Record<string, string> {
  if (!attrs) return {};
  const out: Record<string, string> = {};
  for (const a of attrs) {
    out[a.Name] = a.Value;
  }
  return out;
}

/**
 * Convert a record to Cognito's wire format. Applies the `dev:` prefix to
 * developer-only attributes (fixes upstream #393).
 */
export function recordToAttributesArray(
  attrs: Record<string, string>,
  schema: SchemaAttribute[] = []
): { Name: string; Value: string }[] {
  const devOnly = new Set(
    schema.filter((s) => s.developerOnlyAttribute).map((s) => s.name)
  );
  return Object.entries(attrs).map(([Name, Value]) => {
    if (devOnly.has(Name) || devOnly.has(stripPrefix(Name))) {
      const inner = stripPrefix(Name);
      return { Name: `dev:custom:${inner}`, Value };
    }
    return { Name, Value };
  });
}

function stripPrefix(name: string): string {
  if (name.startsWith("custom:")) return name.slice("custom:".length);
  if (name.startsWith("dev:custom:")) return name.slice("dev:custom:".length);
  return name;
}

/**
 * Find a schema attribute by name. Handles `custom:foo`, `dev:custom:foo`,
 * and bare `foo` lookups.
 */
export function findSchemaAttribute(
  schema: SchemaAttribute[],
  name: string
): SchemaAttribute | undefined {
  const bare = stripPrefix(name);
  return schema.find((s) => s.name === name || s.name === bare);
}

/**
 * Validate that all required attributes are present in the supplied set,
 * and that string/number constraints are honored. Throws InvalidParameterError
 * on the first violation. Fixes upstream #431.
 */
export function validateAttributesForSignUp(
  pool: UserPool,
  supplied: Record<string, string>
): void {
  for (const attr of pool.schema) {
    if (attr.required) {
      const provided =
        supplied[attr.name] ??
        supplied[`custom:${attr.name}`] ??
        supplied[`dev:custom:${attr.name}`];
      if (provided === undefined || provided === "") {
        throw new InvalidParameterError(
          `Attribute '${attr.name}' is required.`
        );
      }
    }

    const value =
      supplied[attr.name] ??
      supplied[`custom:${attr.name}`] ??
      supplied[`dev:custom:${attr.name}`];
    if (value === undefined) continue;

    if (
      attr.attributeDataType === "String" &&
      attr.stringAttributeConstraints
    ) {
      const min = attr.stringAttributeConstraints.minLength
        ? parseInt(attr.stringAttributeConstraints.minLength, 10)
        : undefined;
      const max = attr.stringAttributeConstraints.maxLength
        ? parseInt(attr.stringAttributeConstraints.maxLength, 10)
        : undefined;
      if (min !== undefined && value.length < min) {
        throw new InvalidParameterError(
          `Attribute '${attr.name}' is shorter than the minimum length ${min}.`
        );
      }
      if (max !== undefined && value.length > max) {
        throw new InvalidParameterError(
          `Attribute '${attr.name}' is longer than the maximum length ${max}.`
        );
      }
    }

    if (
      attr.attributeDataType === "Number" &&
      attr.numberAttributeConstraints
    ) {
      const n = Number(value);
      if (Number.isNaN(n)) {
        throw new InvalidParameterError(
          `Attribute '${attr.name}' must be a number.`
        );
      }
      const min = attr.numberAttributeConstraints.minValue
        ? Number(attr.numberAttributeConstraints.minValue)
        : undefined;
      const max = attr.numberAttributeConstraints.maxValue
        ? Number(attr.numberAttributeConstraints.maxValue)
        : undefined;
      if (min !== undefined && n < min) {
        throw new InvalidParameterError(
          `Attribute '${attr.name}' is below the minimum value ${min}.`
        );
      }
      if (max !== undefined && n > max) {
        throw new InvalidParameterError(
          `Attribute '${attr.name}' is above the maximum value ${max}.`
        );
      }
    }
  }
}

/**
 * Render user attributes for response, masking developer-only attributes.
 */
export function renderUserAttributes(
  user: CognitoUser,
  pool: UserPool | undefined
): { Name: string; Value: string }[] {
  return recordToAttributesArray(user.attributes, pool?.schema ?? []);
}
