import * as SQLite from 'expo-sqlite';
export type Change = { key: string; value: string | null };
let database: Promise<SQLite.SQLiteDatabase> | undefined;
function db() {
  return database ??= (async () => {
    const connection = await SQLite.openDatabaseAsync('tachyon-drive-v2.db');
    await connection.execAsync('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; CREATE TABLE IF NOT EXISTS records (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);');
    return connection;
  })();
}
export async function readAll(): Promise<Record<string, string>> {
  const rows = await (await db()).getAllAsync<{ key: string; value: string }>('SELECT key, value FROM records');
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}
export async function commit(changes: Change[]): Promise<void> {
  const connection = await db();
  await connection.withExclusiveTransactionAsync(async tx => {
    for (const { key, value } of changes) {
      if (value === null) await tx.runAsync('DELETE FROM records WHERE key = ?', key);
      else await tx.runAsync('INSERT INTO records (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
    }
  });
}
