/**
 * Shared DynamoDB client for Lambda functions.
 *
 * Replaces generateClient<Schema>() (Amplify frontend pattern) with direct
 * DynamoDB SDK access. Lambda resolvers should not call AppSync back — they
 * should read/write DynamoDB directly using their IAM execution role.
 *
 * Table names follow the Amplify Gen2 pattern: <ModelName>-<API_ID>-NONE.
 * The API ID suffix is discovered at cold-start from the existing Kingdom table
 * and cached for subsequent warm invocations.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  ListTablesCommand,
} from '@aws-sdk/lib-dynamodb';

const REGION = process.env.AWS_REGION ?? 'eu-west-1';

const ddb = new DynamoDBClient({ region: REGION });
export const docClient = DynamoDBDocumentClient.from(ddb, {
  marshallOptions: { removeUndefinedValues: true },
});

let _tableSuffix: string | undefined;

/** Discovers the Amplify table suffix (API_ID-NONE) from the existing Kingdom table. */
async function getTableSuffix(): Promise<string> {
  if (_tableSuffix) return _tableSuffix;
  const { TableNames } = await ddb.send(new ListTablesCommand({}));
  const match = TableNames?.find(t => /^Kingdom-[^-]+-NONE$/.test(t));
  if (!match) throw new Error('[data-client] Cannot locate Kingdom table to determine table suffix');
  _tableSuffix = match.slice('Kingdom-'.length, -'-NONE'.length);
  return _tableSuffix;
}

/** Returns the DynamoDB table name for an Amplify model. */
export async function getTableName(modelName: string): Promise<string> {
  const suffix = await getTableSuffix();
  return `${modelName}-${suffix}-NONE`;
}

/** Scans all items from a model's table. Returns all pages merged. */
export async function dbList<T>(modelName: string): Promise<T[]> {
  const TableName = await getTableName(modelName);
  const items: T[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(new ScanCommand({ TableName, ExclusiveStartKey }));
    items.push(...((result.Items ?? []) as T[]));
    ExclusiveStartKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);
  return items;
}

/** Gets a single item by primary key id. Returns null if not found. */
export async function dbGet<T>(modelName: string, id: string): Promise<T | null> {
  const TableName = await getTableName(modelName);
  const result = await docClient.send(new GetCommand({ TableName, Key: { id } }));
  return (result.Item as T) ?? null;
}

/** Puts (creates) an item. Auto-generates id, createdAt, updatedAt, __typename. */
export async function dbCreate<T extends Record<string, unknown>>(
  modelName: string,
  item: T
): Promise<T & { id: string; createdAt: string; updatedAt: string; __typename: string }> {
  const TableName = await getTableName(modelName);
  const now = new Date().toISOString();
  const fullItem = {
    ...item,
    id: (item.id as string | undefined) ?? crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    __typename: modelName,
  };
  await docClient.send(new PutCommand({ TableName, Item: fullItem }));
  return fullItem as T & { id: string; createdAt: string; updatedAt: string; __typename: string };
}

/** Updates specific fields of an existing item by id. */
export async function dbUpdate(
  modelName: string,
  id: string,
  updates: Record<string, unknown>
): Promise<void> {
  const TableName = await getTableName(modelName);
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = {};
  const setParts: string[] = [];

  const safeUpdates = { ...updates, updatedAt: new Date().toISOString() };
  for (const [k, v] of Object.entries(safeUpdates)) {
    const alias = `#${k}`;
    const valAlias = `:${k}`;
    names[alias] = k;
    values[valAlias] = v;
    setParts.push(`${alias} = ${valAlias}`);
  }

  await docClient.send(new UpdateCommand({
    TableName,
    Key: { id },
    UpdateExpression: `SET ${setParts.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

/** Deletes an item by id. */
export async function dbDelete(modelName: string, id: string): Promise<void> {
  const TableName = await getTableName(modelName);
  await docClient.send(new DeleteCommand({ TableName, Key: { id } }));
}
