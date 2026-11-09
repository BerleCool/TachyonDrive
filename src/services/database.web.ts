export type Change = { key: string; value: string | null };
const KEY = 'tachyon-drive-preview-v2';
export async function readAll(): Promise<Record<string, string>> {
  const raw = globalThis.localStorage?.getItem(KEY);
  return raw ? JSON.parse(raw) : {};
}
export async function commit(changes: Change[]): Promise<void> {
  const entries = await readAll();
  for (const { key, value } of changes) {
    if (value === null) delete entries[key]; else entries[key] = value;
  }
  globalThis.localStorage.setItem(KEY, JSON.stringify(entries));
}
