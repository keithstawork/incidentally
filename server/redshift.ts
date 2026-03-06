import {
  RedshiftDataClient,
  ExecuteStatementCommand,
  DescribeStatementCommand,
  GetStatementResultCommand,
  StatusString,
} from "@aws-sdk/client-redshift-data";

const CLUSTER_ID = process.env.REDSHIFT_CLUSTER_ID || "instawork-dw";
const DATABASE = process.env.REDSHIFT_DATABASE || "instawork";
const DB_USER = process.env.REDSHIFT_DB_USER || "engineering";
const REGION = process.env.AWS_REGION || "us-west-2";
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

const client = new RedshiftDataClient({ region: REGION });

// ── Structured error types ──────────────────────────────────────────────────

export class RedshiftError extends Error {
  constructor(message: string, public readonly code: RedshiftErrorCode) {
    super(message);
    this.name = "RedshiftError";
  }
}

export type RedshiftErrorCode = "AUTH_EXPIRED" | "QUERY_FAILED" | "QUERY_ABORTED" | "TIMEOUT";

function classifyError(errorMessage: string): RedshiftErrorCode {
  const lower = errorMessage.toLowerCase();
  if (lower.includes("expired") || lower.includes("credential") || lower.includes("token")) {
    return "AUTH_EXPIRED";
  }
  return "QUERY_FAILED";
}

// ── Query execution ─────────────────────────────────────────────────────────

export interface QueryOptions {
  timeoutMs?: number;
}

type FieldValue = string | number | boolean | null;

function extractFieldValue(field: Record<string, any>): FieldValue {
  if (field.isNull) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.longValue !== undefined) return field.longValue;
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  return null;
}

async function waitForStatement(statementId: string, timeoutMs: number): Promise<void> {
  const terminalStates = new Set<string>([
    StatusString.FINISHED,
    StatusString.FAILED,
    StatusString.ABORTED,
  ]);

  let pollInterval = 200;
  const startTime = Date.now();

  while (true) {
    const desc = await client.send(
      new DescribeStatementCommand({ Id: statementId })
    );

    if (terminalStates.has(desc.Status!)) {
      if (desc.Status === StatusString.FAILED) {
        const code = classifyError(desc.Error || "");
        throw new RedshiftError(`Redshift query failed: ${desc.Error}`, code);
      }
      if (desc.Status === StatusString.ABORTED) {
        throw new RedshiftError("Redshift query was aborted", "QUERY_ABORTED");
      }
      return;
    }

    if (Date.now() - startTime > timeoutMs) {
      throw new RedshiftError(
        `Redshift query timed out after ${timeoutMs / 1000}s (id: ${statementId})`,
        "TIMEOUT",
      );
    }

    await new Promise((r) => setTimeout(r, pollInterval));
    pollInterval = Math.min(pollInterval * 1.5, 2000);
  }
}

/**
 * Execute a SQL query against Redshift and return raw columns + rows.
 * Handles pagination automatically for large result sets (>100K records).
 */
export async function executeRedshiftQuery(
  sql: string,
  opts?: QueryOptions,
): Promise<{ columns: string[]; rows: FieldValue[][] }> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const exec = await client.send(
    new ExecuteStatementCommand({
      ClusterIdentifier: CLUSTER_ID,
      Database: DATABASE,
      DbUser: DB_USER,
      Sql: sql,
    })
  );

  await waitForStatement(exec.Id!, timeoutMs);

  let columns: string[] = [];
  const allRows: FieldValue[][] = [];
  let nextToken: string | undefined;

  do {
    const result = await client.send(
      new GetStatementResultCommand({
        Id: exec.Id!,
        NextToken: nextToken,
      })
    );

    if (columns.length === 0) {
      columns = (result.ColumnMetadata || []).map((c) => c.name || "");
    }

    const pageRows = (result.Records || []).map((row) =>
      row.map(extractFieldValue)
    );
    allRows.push(...pageRows);
    nextToken = result.NextToken;
  } while (nextToken);

  return { columns, rows: allRows };
}

// ── Typed row mapper ────────────────────────────────────────────────────────

type ColumnMapping<T> = {
  [K in keyof T]: string | ((row: FieldValue[], colIndex: Record<string, number>) => T[K]);
};

/**
 * Map raw Redshift rows into typed objects using a column mapping.
 *
 * Each key in the mapping is either:
 * - a string matching a column name (value is taken directly)
 * - a function that receives the row + column index and returns a computed value
 *
 * Example:
 *   const pros = mapRows<{ id: number; name: string }>(columns, rows, {
 *     id: "worker_id",
 *     name: (row, ci) => `${row[ci.given_name]} ${row[ci.family_name]}`,
 *   });
 */
export function mapRows<T>(
  columns: string[],
  rows: FieldValue[][],
  mapping: ColumnMapping<T>,
): T[] {
  const colIndex = Object.fromEntries(columns.map((c, i) => [c, i])) as Record<string, number>;

  return rows.map((row) => {
    const obj = {} as T;
    for (const [key, mapper] of Object.entries(mapping) as [keyof T, string | Function][]) {
      if (typeof mapper === "string") {
        obj[key] = row[colIndex[mapper]] as T[keyof T];
      } else {
        obj[key] = (mapper as Function)(row, colIndex) as T[keyof T];
      }
    }
    return obj;
  });
}

/**
 * Convenience: build a column index from a columns array.
 * Returns a Record mapping column name → array index.
 */
export function buildColumnIndex(columns: string[]): Record<string, number> {
  return Object.fromEntries(columns.map((c, i) => [c, i]));
}
