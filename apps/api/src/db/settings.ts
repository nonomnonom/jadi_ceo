import type { Db } from './client.js';

export type SettingKey =
  | 'openrouterApiKey'
  | 'telegramBotToken'
  | 'telegramOwnerChatId'
  | 'whatsappAutoReply'
  | 'pakasirProject'
  | 'pakasirApiKey'
  | 'customerAgentEnabled'
  | 'ownerModel';

export async function getSetting(
  db: Db,
  tenantId: string,
  key: SettingKey,
): Promise<string | null> {
  const res = await db.execute({
    sql: 'SELECT value FROM settings WHERE tenant_id = ? AND key = ?',
    args: [tenantId, key],
  });
  const row = res.rows[0];
  if (!row || row.value == null) return null;
  return String(row.value);
}

export async function setSetting(
  db: Db,
  tenantId: string,
  key: SettingKey,
  value: string | null,
): Promise<void> {
  const now = Date.now();
  await db.execute({
    sql: `INSERT INTO settings (tenant_id, key, value, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT (tenant_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    args: [tenantId, key, value, now],
  });
}

export function maskSecret(value: string | null): string | null {
  if (!value) return null;
  const len = value.length;
  if (len <= 4) return '•'.repeat(len);
  return `${'•'.repeat(len - 4)}${value.slice(-4)}`;
}
