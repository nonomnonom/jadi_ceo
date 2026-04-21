import { relative, resolve } from 'node:path';
import { DEFAULT_TENANT_ID as tenantId } from '@juragan/shared';
import { registerApiRoute } from '@mastra/core/server';
import QRCode from 'qrcode';
import { getWhatsAppManager } from '../channels/whatsapp-manager.js';
import { getDb } from '../db/client.js';
import { type SettingKey, getSetting, maskSecret, setSetting } from '../db/settings.js';
import { createTelegramSender, tickOnce } from '../reminders/executor.js';
import { juraganAgent, ownerWorkspace } from './agents/juragan.js';

function requireAuth(c: {
  req: { header: (name: string) => string | undefined };
}): Response | null {
  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) return null; // auth disabled when var is unset
  const token = c.req.header('authorization') ?? '';
  if (token !== `Bearer ${secret}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

function workspacePathSafe(requestedPath: string): boolean {
  const fs = ownerWorkspace.filesystem as { basePath?: string };
  const base = fs.basePath ?? '';
  if (!base) return true; // no base — skip check
  const resolved = resolve(base, requestedPath.replace(/^\/+/, ''));
  return !relative(base, resolved).startsWith('..');
}

type TelegramGetMeResult = {
  ok: boolean;
  result?: { id: number; is_bot: boolean; first_name: string; username: string };
  description?: string;
};

async function telegramGetMe(
  token: string,
): Promise<
  | { ok: true; bot: { id: number; username: string; firstName: string } }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`, {
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json()) as TelegramGetMeResult;
    if (!data.ok || !data.result) {
      return { ok: false, error: data.description ?? `HTTP ${res.status}` };
    }
    return {
      ok: true,
      bot: {
        id: data.result.id,
        username: data.result.username,
        firstName: data.result.first_name,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Request failed' };
  }
}

export const apiRoutes = [
  registerApiRoute('/custom/settings', {
    method: 'GET',
    openapi: {
      summary: 'Get redacted onboarding settings for the current tenant',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const db = getDb();
      const openrouterApiKey = await getSetting(db, tenantId, 'openrouterApiKey');
      const telegramBotToken = await getSetting(db, tenantId, 'telegramBotToken');
      const telegramOwnerChatId = await getSetting(db, tenantId, 'telegramOwnerChatId');
      return c.json({
        openrouterApiKey: maskSecret(openrouterApiKey),
        telegramBotToken: maskSecret(telegramBotToken),
        telegramOwnerChatId,
        configured: Boolean(openrouterApiKey),
        envHasOpenRouter: Boolean(process.env.OPENROUTER_API_KEY),
      });
    },
  }),
  registerApiRoute('/custom/settings', {
    method: 'POST',
    openapi: {
      summary: 'Save onboarding settings. Requires API server restart to apply.',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const body = (await c.req.json().catch(() => null)) as {
        openrouterApiKey?: string;
        telegramBotToken?: string;
        telegramOwnerChatId?: string;
      } | null;
      if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
      const db = getDb();
      const saved: SettingKey[] = [];
      if (typeof body.openrouterApiKey === 'string' && body.openrouterApiKey.length > 0) {
        await setSetting(db, tenantId, 'openrouterApiKey', body.openrouterApiKey);
        saved.push('openrouterApiKey');
      }
      if (typeof body.telegramBotToken === 'string' && body.telegramBotToken.length > 0) {
        await setSetting(db, tenantId, 'telegramBotToken', body.telegramBotToken);
        saved.push('telegramBotToken');
      }
      if (typeof body.telegramOwnerChatId === 'string' && body.telegramOwnerChatId.length > 0) {
        await setSetting(db, tenantId, 'telegramOwnerChatId', body.telegramOwnerChatId);
        saved.push('telegramOwnerChatId');
      }
      return c.json({
        saved,
        restartRequired: saved.some((k) => k !== 'telegramOwnerChatId'),
      });
    },
  }),
  registerApiRoute('/custom/telegram/test', {
    method: 'POST',
    openapi: {
      summary: "Validate a Telegram bot token via Telegram's getMe. Does NOT save the token.",
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const body = (await c.req.json().catch(() => null)) as { token?: string } | null;
      const token = body?.token?.trim();
      if (!token) return c.json({ ok: false, error: 'token required' }, 400);
      const result = await telegramGetMe(token);
      return c.json(result, result.ok ? 200 : 400);
    },
  }),
  registerApiRoute('/custom/telegram/status', {
    method: 'GET',
    openapi: {
      summary: 'Report whether the Telegram channel is wired + return bot identity if so',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        return c.json({
          configured: false,
          note: 'TELEGRAM_BOT_TOKEN not set. Save it in Settings and restart the API server.',
        });
      }
      const result = await telegramGetMe(token);
      if (!result.ok) {
        return c.json({ configured: true, botReachable: false, error: result.error });
      }
      return c.json({
        configured: true,
        botReachable: true,
        bot: result.bot,
        deepLink: `https://t.me/${result.bot.username}`,
      });
    },
  }),
  registerApiRoute('/custom/reminders/tick', {
    method: 'POST',
    openapi: {
      summary: 'Manually run the reminder executor once. Handy for testing without waiting 60s.',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const db = getDb();
      const botToken = process.env.TELEGRAM_BOT_TOKEN ?? null;
      const chatId = process.env.TELEGRAM_OWNER_CHAT_ID ?? null;
      const send = botToken
        ? createTelegramSender(botToken)
        : async () => ({ ok: false as const, error: 'no bot token' });
      const result = await tickOnce({ db, tenantId, botToken, chatId, send });
      return c.json(result);
    },
  }),
  registerApiRoute('/custom/workspace/files', {
    method: 'GET',
    openapi: {
      summary: 'List files and directories in the owner workspace at the given path',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const raw = c.req.query('path') ?? '';
      const reqPath = raw === '/' ? '' : raw.replace(/^\/+/, '');
      if (!workspacePathSafe(reqPath)) {
        return c.json({ error: 'path escapes workspace' }, 403);
      }
      const fs = ownerWorkspace.filesystem;
      if (!fs) return c.json({ entries: [] });
      try {
        const rawEntries = await fs.readdir(reqPath === '' ? '.' : reqPath);
        const entries = rawEntries.map((e) => ({
          name: e.name,
          path: reqPath === '' ? e.name : `${reqPath}/${e.name}`,
          kind: e.type,
          size: e.size ?? undefined,
        }));
        return c.json({ entries });
      } catch (err) {
        return c.json({ error: err instanceof Error ? err.message : 'Gagal membaca folder' }, 404);
      }
    },
  }),
  registerApiRoute('/custom/workspace/file', {
    method: 'GET',
    openapi: {
      summary: 'Read a file from the owner workspace as UTF-8 text',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const path = c.req.query('path');
      if (!path) return c.json({ error: 'path query param required' }, 400);
      if (!workspacePathSafe(path)) {
        return c.json({ error: 'path escapes workspace' }, 403);
      }
      const fs = ownerWorkspace.filesystem;
      if (!fs) return c.json({ error: 'no filesystem configured' }, 500);
      try {
        const content = await fs.readFile(path, { encoding: 'utf-8' });
        return c.json({
          path,
          content: typeof content === 'string' ? content : content.toString('utf-8'),
        });
      } catch (err) {
        return c.json({ error: err instanceof Error ? err.message : 'Gagal membaca file' }, 404);
      }
    },
  }),
  registerApiRoute('/custom/scheduled-prompts', {
    method: 'GET',
    openapi: {
      summary: 'List all active scheduled prompts for the current tenant',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const db = getDb();
      const result = await db.execute({
        sql: `SELECT id, prompt, interval_sec, cron_expr, next_fire_at,
                      active, last_fire_at, last_result, created_at
               FROM scheduled_prompts WHERE tenant_id = ? AND active = 1
               ORDER BY next_fire_at ASC`,
        args: [tenantId],
      });
      return c.json({
        prompts: result.rows.map((r) => ({
          id: Number(r.id),
          prompt: String(r.prompt),
          intervalSec: Number(r.interval_sec),
          cronExpr: String(r.cron_expr),
          nextFireAt: Number(r.next_fire_at),
          active: Number(r.active) === 1,
          lastFireAt: r.last_fire_at != null ? Number(r.last_fire_at) : null,
          lastResult: r.last_result != null ? String(r.last_result) : null,
          createdAt: Number(r.created_at),
        })),
      });
    },
  }),
  registerApiRoute('/custom/execute-scheduled-prompt', {
    method: 'POST',
    openapi: {
      summary: 'Execute a scheduled prompt through the Juragan agent and send result to Telegram',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const body = (await c.req.json().catch(() => null)) as { scheduledPromptId?: number } | null;
      if (!body?.scheduledPromptId) {
        return c.json({ error: 'scheduledPromptId required' }, 400);
      }
      const db = getDb();
      const row = await db.execute({
        sql: `SELECT id, prompt, cron_expr, interval_sec, active
               FROM scheduled_prompts WHERE id = ? AND tenant_id = ? AND active = 1`,
        args: [body.scheduledPromptId, tenantId],
      });
      const sched = row.rows[0];
      if (!sched) {
        return c.json({ error: 'scheduled prompt not found or inactive' }, 404);
      }

      // Run the agent
      const response = await juraganAgent.generate(String(sched.prompt));

      // Send to Telegram
      const botToken = process.env.TELEGRAM_BOT_TOKEN ?? null;
      const chatId = process.env.TELEGRAM_OWNER_CHAT_ID ?? null;
      if (botToken && chatId) {
        const send = createTelegramSender(botToken);
        const resultText =
          typeof response.text === 'string' ? response.text : JSON.stringify(response.text);
        await send(chatId, `🔄 <b>Scheduled:</b>\n\n${resultText.slice(0, 4000)}`);
      }

      // Update last_fire_at
      const now = Date.now();
      const resultText = typeof response.text === 'string' ? response.text.slice(0, 5000) : '';
      const schedId = Number(sched.id);
      await db.execute({
        sql: 'UPDATE scheduled_prompts SET last_fire_at = ?, last_result = ? WHERE id = ?',
        args: [now, resultText, schedId],
      });

      return c.json({ ok: true, response: response.text });
    },
  }),
  registerApiRoute('/custom/whatsapp/status', {
    method: 'GET',
    openapi: {
      summary: 'Get WhatsApp connection status',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const manager = getWhatsAppManager();
      const status = manager.getStatus();
      return c.json({
        connected: status.connected,
        qr: status.qr,
      });
    },
  }),
  registerApiRoute('/custom/whatsapp/qr', {
    method: 'GET',
    openapi: {
      summary: 'Get the latest WhatsApp QR code as base64 PNG',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const manager = getWhatsAppManager();
      const status = manager.getStatus();
      if (!status.qr) {
        return c.json({ qr: null, connected: status.connected }, 200);
      }
      const base64 = await QRCode.toDataURL(status.qr, { width: 256, margin: 2 });
      return c.json({ qr: base64, connected: status.connected });
    },
  }),
  registerApiRoute('/custom/whatsapp/connect', {
    method: 'POST',
    openapi: {
      summary: 'Start WhatsApp connection (generates QR code)',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const manager = getWhatsAppManager();
      try {
        await manager.connect();
        return c.json({ ok: true });
      } catch (err) {
        return c.json(
          { ok: false, error: err instanceof Error ? err.message : 'Connection failed' },
          500,
        );
      }
    },
  }),
  registerApiRoute('/custom/whatsapp/disconnect', {
    method: 'POST',
    openapi: {
      summary: 'Disconnect WhatsApp connection',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const manager = getWhatsAppManager();
      await manager.disconnect();
      return c.json({ ok: true });
    },
  }),
];
