/**
 * Unwrap an Amplify custom-operation response into the handler's object.
 *
 * AppSync custom queries/mutations typed `.returns(a.json())` whose Lambda
 * handlers already `JSON.stringify(...)` come back DOUBLE-encoded: the client
 * `.data` is a JSON string whose decoded value is ITSELF a JSON string. A single
 * `JSON.parse` therefore leaves a string, and callers reading `.success` /
 * `.kingdoms` / `.season` on it silently get `undefined` — which surfaced as
 * "no active season" on kingdom creation and empty admin kingdom lists.
 *
 * This decodes through any number of JSON-string layers (single OR double),
 * stopping at the first value that isn't a parseable JSON string.
 */
export function unwrapAmplifyJson<T = unknown>(raw: unknown): T {
  let value: unknown = raw;
  // Strip the `{ data: ... }` envelope if present.
  if (value && typeof value === 'object' && 'data' in (value as object)) {
    value = (value as { data: unknown }).data;
  }
  let depth = 0;
  while (typeof value === 'string' && depth < 4) {
    try {
      value = JSON.parse(value);
      depth++;
    } catch {
      break; // not (further) JSON — return the string as-is
    }
  }
  return value as T;
}
