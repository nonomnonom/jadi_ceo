import { registerApiRoute } from '@mastra/core/server';
import { getDb } from '../db/client.js';
import { type SettingKey, getSetting, maskSecret, setSetting } from '../db/settings.js';
import { ownerWorkspace } from './agents/juragan.js';

const tenantId = process.env.DEFAULT_TENANT_ID ?? 'default';

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
      const db = getDb();
      const openrouterApiKey = await getSetting(db, tenantId, 'openrouterApiKey');
      const telegramBotToken = await getSetting(db, tenantId, 'telegramBotToken');
      return c.json({
        openrouterApiKey: maskSecret(openrouterApiKey),
        telegramBotToken: maskSecret(telegramBotToken),
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
      const body = (await c.req.json().catch(() => null)) as {
        openrouterApiKey?: string;
        telegramBotToken?: string;
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
      return c.json({
        saved,
        restartRequired: saved.length > 0,
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
  registerApiRoute('/custom/workspace/files', {
    method: 'GET',
    openapi: {
      summary: 'List files and directories in the owner workspace at the given path',
      tags: ['custom'],
    },
    handler: async (c) => {
      // LocalFilesystem contained mode resolves relative paths against basePath, so '' == root.
      const raw = c.req.query('path') ?? '';
      const path = raw === '/' ? '' : raw.replace(/^\/+/, '');
      const fs = ownerWorkspace.filesystem;
      if (!fs) return c.json({ entries: [] });
      try {
        const rawEntries = await fs.readdir(path === '' ? '.' : path);
        const entries = rawEntries.map((e) => ({
          name: e.name,
          path: path === '' ? e.name : `${path}/${e.name}`,
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
      const path = c.req.query('path');
      if (!path) return c.json({ error: 'path query param required' }, 400);
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
];
