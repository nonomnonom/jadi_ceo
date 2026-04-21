export type SendResult = { ok: true } | { ok: false; error: string };

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
): Promise<SendResult> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) return { ok: false, error: data.description ?? `HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'send failed' };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatReminderMessage(
  reminder: { content: string; remindAt: number },
  now = Date.now(),
): string {
  const scheduled = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(reminder.remindAt));
  const lateMinutes = Math.max(0, Math.round((now - reminder.remindAt) / 60_000));
  const lateTag = lateMinutes >= 2 ? ` (telat ${lateMinutes} menit)` : '';
  return `⏰ <b>Pengingat</b>\n\n${escapeHtml(reminder.content)}\n\n<i>Dijadwalkan ${scheduled} WIB${lateTag}</i>`;
}
