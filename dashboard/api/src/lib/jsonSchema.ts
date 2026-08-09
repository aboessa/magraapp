/// A small JSON Schema evaluator, scoped to the keywords Majarra's engine pack
/// schemas actually use.
///
/// ## Why this exists rather than a library
///
/// The game pack rules are already written down as JSON Schema in
/// `docs/games/schemas/`. Re-expressing them as hand-written TypeScript checks
/// would create two descriptions of the same contract that drift apart, and the
/// schema files are what the engine contracts link to, so they are the ones
/// authors read. Validating the real schema document keeps a single source of
/// truth.
///
/// A full library was not used because this runs in a Worker, where every
/// kilobyte is in the request path, and because the schemas only need a closed
/// set of keywords. Anything outside that set is rejected loudly by
/// [assertSupportedSchema] instead of being silently ignored — silent tolerance
/// is how a validator ends up passing a pack it never actually checked.
///
/// Supported: `type`, `const`, `enum`, `required`, `properties`,
/// `additionalProperties`, `patternProperties`, `items`, `minItems`, `maxItems`,
/// `minimum`, `maximum`, `minLength`, `maxLength`, `pattern`, `$ref` (local
/// `#/$defs/...` only), `allOf`, `if`/`then`/`else`, `default` (annotation),
/// plus the annotations `$schema`, `$id`, `$comment`, `title`, `description`.

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type Schema = Record<string, unknown>;

const SUPPORTED_KEYWORDS = new Set([
  'type', 'const', 'enum', 'required', 'properties', 'additionalProperties',
  'patternProperties', 'items', 'minItems', 'maxItems', 'minimum', 'maximum',
  'minLength', 'maxLength', 'pattern', '$ref', 'allOf', 'if', 'then', 'else',
  // Annotations, no validation effect.
  '$schema', '$id', '$comment', 'title', 'description', 'default', '$defs',
]);

/// Fails fast when a schema uses a keyword this evaluator does not implement.
///
/// Without this, adding `oneOf` to a schema would make that constraint vanish
/// silently and the validator would report a pack as valid without having
/// checked the rule.
export function assertSupportedSchema(schema: Schema, path = '#'): void {
  for (const key of Object.keys(schema)) {
    if (!SUPPORTED_KEYWORDS.has(key)) {
      throw new Error(`Unsupported JSON Schema keyword "${key}" at ${path}`);
    }
  }
  const walk = (value: unknown, childPath: string) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      assertSupportedSchema(value as Schema, childPath);
    }
  };
  for (const [key, value] of Object.entries(schema.$defs ?? {})) walk(value, `${path}/$defs/${key}`);
  for (const [key, value] of Object.entries((schema.properties ?? {}) as Record<string, unknown>)) {
    walk(value, `${path}/properties/${key}`);
  }
  for (const [key, value] of Object.entries((schema.patternProperties ?? {}) as Record<string, unknown>)) {
    walk(value, `${path}/patternProperties/${key}`);
  }
  walk(schema.items, `${path}/items`);
  walk(schema.if, `${path}/if`);
  walk(schema.then, `${path}/then`);
  walk(schema.else, `${path}/else`);
  if (typeof schema.additionalProperties === 'object') {
    walk(schema.additionalProperties, `${path}/additionalProperties`);
  }
  if (Array.isArray(schema.allOf)) {
    schema.allOf.forEach((entry, index) => walk(entry, `${path}/allOf/${index}`));
  }
}

function typeMatches(value: unknown, type: string): boolean {
  switch (type) {
    case 'object': return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'array': return Array.isArray(value);
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    // JSON Schema treats 1.0 as an integer; Number.isInteger agrees.
    case 'integer': return typeof value === 'number' && Number.isInteger(value);
    case 'boolean': return typeof value === 'boolean';
    case 'null': return value === null;
    default: return false;
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (typeof a !== 'object') return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => deepEqual(left[key], right[key]));
}

function resolveRef(root: Schema, ref: string): Schema {
  if (!ref.startsWith('#/')) throw new Error(`Only local $ref is supported, got "${ref}"`);
  let node: unknown = root;
  for (const segment of ref.slice(2).split('/')) {
    if (!node || typeof node !== 'object') throw new Error(`Unresolvable $ref "${ref}"`);
    node = (node as Record<string, unknown>)[segment];
  }
  if (!node || typeof node !== 'object') throw new Error(`Unresolvable $ref "${ref}"`);
  return node as Schema;
}

/// True when `value` satisfies `schema`, used only for `if` branches where the
/// outcome selects a subschema rather than producing an error.
function matches(root: Schema, schema: Schema, value: unknown): boolean {
  return validateNode(root, schema, value, '').length === 0;
}

function validateNode(root: Schema, schema: Schema, value: unknown, path: string): string[] {
  if (typeof schema.$ref === 'string') {
    return validateNode(root, resolveRef(root, schema.$ref), value, path);
  }

  const errors: string[] = [];
  const at = path || 'pack';

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type as string[] : [schema.type as string];
    if (!types.some((type) => typeMatches(value, type))) {
      errors.push(`${at}: expected ${types.join(' or ')}`);
      // Every other keyword assumes the type held, so stop here to avoid a
      // cascade of misleading follow-on errors.
      return errors;
    }
  }

  if (schema.const !== undefined && !deepEqual(value, schema.const)) {
    errors.push(`${at}: must equal ${JSON.stringify(schema.const)}`);
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((option) => deepEqual(option, value))) {
    errors.push(`${at}: must be one of ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}`);
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      errors.push(`${at}: shorter than ${schema.minLength} characters`);
    }
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
      errors.push(`${at}: longer than ${schema.maxLength} characters`);
    }
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern, 'u').test(value)) {
      errors.push(`${at}: does not match ${schema.pattern}`);
    }
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      errors.push(`${at}: below minimum ${schema.minimum}`);
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      errors.push(`${at}: above maximum ${schema.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
      errors.push(`${at}: needs at least ${schema.minItems} item(s)`);
    }
    if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
      errors.push(`${at}: allows at most ${schema.maxItems} item(s)`);
    }
    if (schema.items && typeof schema.items === 'object') {
      value.forEach((entry, index) => {
        errors.push(...validateNode(root, schema.items as Schema, entry, `${at}[${index}]`));
      });
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;

    for (const key of (schema.required ?? []) as string[]) {
      if (!(key in record)) errors.push(`${at}: missing required property "${key}"`);
    }

    const properties = (schema.properties ?? {}) as Record<string, Schema>;
    const patternProperties = (schema.patternProperties ?? {}) as Record<string, Schema>;

    for (const [key, entry] of Object.entries(record)) {
      const childPath = path ? `${path}.${key}` : key;
      let handled = false;

      if (key in properties) {
        handled = true;
        errors.push(...validateNode(root, properties[key], entry, childPath));
      }
      for (const [pattern, subschema] of Object.entries(patternProperties)) {
        if (!new RegExp(pattern, 'u').test(key)) continue;
        handled = true;
        errors.push(...validateNode(root, subschema, entry, childPath));
      }
      if (!handled) {
        if (schema.additionalProperties === false) {
          errors.push(`${childPath}: unexpected property`);
        } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
          errors.push(...validateNode(root, schema.additionalProperties as Schema, entry, childPath));
        }
      }
    }
  }

  if (Array.isArray(schema.allOf)) {
    for (const entry of schema.allOf as Schema[]) {
      errors.push(...validateNode(root, entry, value, path));
    }
  }

  if (schema.if && typeof schema.if === 'object') {
    const branch = matches(root, schema.if as Schema, value) ? schema.then : schema.else;
    if (branch && typeof branch === 'object') {
      errors.push(...validateNode(root, branch as Schema, value, path));
    }
  }

  return errors;
}

/// Validates `value` against `schema`, returning human-readable errors.
///
/// Errors are ordered as encountered and are safe to show an editor: they name
/// the offending path and the rule, and never echo the whole document.
export function validateAgainstSchema(schema: Schema, value: unknown): string[] {
  assertSupportedSchema(schema);
  return validateNode(schema, schema, value, '');
}
