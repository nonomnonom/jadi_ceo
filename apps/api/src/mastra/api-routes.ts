import { registerApiRoute } from '@mastra/core/server';
import { getDb } from '../db/client.js';
import { type SettingKey, getSetting, maskSecret, setSetting } from '../db/settings.js';
import { ownerWorkspace } from './agents/juragan.js';

const tenantId = process.env.DEFAULT_TENANT_ID ?? 'default';

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
