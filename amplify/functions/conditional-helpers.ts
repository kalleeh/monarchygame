/** Returns true if the error is a DynamoDB ConditionalCheckFailedException. */
export function isConditionalCheckFailed(err: unknown): boolean {
  return !!(err && typeof err === 'object' && 'name' in err &&
    (err as { name: string }).name === 'ConditionalCheckFailedException');
}
