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

const client = new RedshiftDataClient({ region: REGION });

const MAX_POLL_MS = 5 * 60 * 1000;

async function waitForStatement(statementId: string): Promise<void> {
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
        throw new Error(`Redshift query failed: ${desc.Error}`);
      }
      if (desc.Status === StatusString.ABORTED) {
        throw new Error("Redshift query was aborted");
      }
      return;
    }

    if (Date.now() - startTime > MAX_POLL_MS) {
      throw new Error(`Redshift query timed out after ${MAX_POLL_MS / 1000}s (id: ${statementId})`);
    }

    await new Promise((r) => setTimeout(r, pollInterval));
    pollInterval = Math.min(pollInterval * 1.5, 2000);
  }
}

export async function executeRedshiftQuery(
  sql: string
): Promise<{ columns: string[]; rows: any[][] }> {
  const exec = await client.send(
    new ExecuteStatementCommand({
      ClusterIdentifier: CLUSTER_ID,
      Database: DATABASE,
      DbUser: DB_USER,
      Sql: sql,
    })
  );

  await waitForStatement(exec.Id!);

  const result = await client.send(
    new GetStatementResultCommand({ Id: exec.Id! })
  );

  const columns = (result.ColumnMetadata || []).map((c) => c.name || "");
  const rows = (result.Records || []).map((row) =>
    row.map((field) => {
      if (field.isNull) return null;
      if (field.stringValue !== undefined) return field.stringValue;
      if (field.longValue !== undefined) return field.longValue;
      if (field.doubleValue !== undefined) return field.doubleValue;
      if (field.booleanValue !== undefined) return field.booleanValue;
      return null;
    })
  );

  return { columns, rows };
}
