import type { Db } from './client.js';

export type SettingKey =
  | 'openrouterApiKey'
  | 'telegramBotToken'
  | 'telegramOwnerChatId'
  | 'whatsappAutoReply'
  | 'pakasirProject'
  | 'pakasirApiKey'
  | 'customerAgentEnabled'
  | 'ownerModel'
  | 'businessHoursStart'
  | 'businessHoursEnd'
  | 'businessDays'
  | 'vacationMode'
  | 'vacationStart'
  | 'vacationEnd'
  | 'vacationMessage';

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

export type BusinessHours = {
  start: string; // "09:00"
  end: string;   // "21:00"
  days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
};

export async function getBusinessHours(db: Db, tenantId: string): Promise<BusinessHours | null> {
  const [start, end, daysStr] = await Promise.all([
    getSetting(db, tenantId, 'businessHoursStart'),
    getSetting(db, tenantId, 'businessHoursEnd'),
    getSetting(db, tenantId, 'businessDays'),
  ]);

  if (!start || !end) return null;

  let days: number[] = [1, 2, 3, 4, 5, 6]; // Mon-Sat default
  if (daysStr) {
    try {
      days = JSON.parse(daysStr);
    } catch {
      // use default
    }
  }

  return { start, end, days };
}

export async function isWithinBusinessHours(db: Db, tenantId: string): Promise<boolean> {
  const hours = await getBusinessHours(db, tenantId);
  if (!hours) return true; // no restriction if not configured

  const now = new Date();

  // Convert to Jakarta timezone (WIB = UTC+7)
  const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const dayOfWeek = jakartaTime.getDay();
  const currentTime = jakartaTime.getHours().toString().padStart(2, '0') + ':' +
    jakartaTime.getMinutes().toString().padStart(2, '0');

  // Check if today is a business day
  if (!hours.days.includes(dayOfWeek)) {
    return false;
  }

  // Check if within business hours
  if (currentTime < hours.start || currentTime > hours.end) {
    return false;
  }

  return true;
}

export type VacationMode = {
  active: boolean;
  start: number | null;
  end: number | null;
  message: string;
};

export async function getVacationMode(db: Db, tenantId: string): Promise<VacationMode> {
  const [activeStr, startStr, endStr, message] = await Promise.all([
    getSetting(db, tenantId, 'vacationMode'),
    getSetting(db, tenantId, 'vacationStart'),
    getSetting(db, tenantId, 'vacationEnd'),
    getSetting(db, tenantId, 'vacationMessage'),
  ]);

  const active = activeStr === 'true';
  const start = startStr ? parseInt(startStr, 10) : null;
  const end = endStr ? parseInt(endStr, 10) : null;

  return {
    active,
    start,
    end,
    message: message || 'Maaf, kami sedang vacation. Akan kembali segera!',
  };
}

export async function isInVacationMode(db: Db, tenantId: string): Promise<{ active: boolean; message: string | null }> {
  const vacation = await getVacationMode(db, tenantId);

  if (!vacation.active) {
    return { active: false, message: null };
  }

  const now = Date.now();

  // If date range is set, check if we're within it
  if (vacation.start !== null && vacation.end !== null) {
    if (now < vacation.start || now > vacation.end) {
      return { active: false, message: null };
    }
  }

  return { active: true, message: vacation.message };
}
