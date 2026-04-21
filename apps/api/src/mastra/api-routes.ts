import { relative, resolve } from 'node:path';
import { DEFAULT_TENANT_ID as tenantId } from '@juragan/shared';
import { registerApiRoute } from '@mastra/core/server';
import QRCode from 'qrcode';
import { getWhatsAppManager, phoneToJid } from '../channels/whatsapp-manager.js';
import { getDb } from '../db/client.js';
import { type SettingKey, getSetting, maskSecret, setSetting } from '../db/settings.js';
import { createTelegramSender, tickOnce } from '../reminders/executor.js';
import { ownerSupervisor, ownerWorkspace } from './agents/owner-supervisor.js';

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
      const whatsappAutoReply = await getSetting(db, tenantId, 'whatsappAutoReply');
      return c.json({
        openrouterApiKey: maskSecret(openrouterApiKey),
        telegramBotToken: maskSecret(telegramBotToken),
        telegramOwnerChatId,
        whatsappAutoReply: whatsappAutoReply === null ? true : whatsappAutoReply === 'true',
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
        whatsappAutoReply?: boolean;
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
      if (typeof body.whatsappAutoReply === 'boolean') {
        await setSetting(db, tenantId, 'whatsappAutoReply', String(body.whatsappAutoReply));
        saved.push('whatsappAutoReply');
      }
      return c.json({
        saved,
        restartRequired: saved.some((k) => k !== 'telegramOwnerChatId' && k !== 'whatsappAutoReply'),
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
      const response = await ownerSupervisor.generate(String(sched.prompt));

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
  registerApiRoute('/custom/pakasir/webhook', {
    method: 'POST',
    openapi: {
      summary: 'Handle Pakasir payment confirmation webhook',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const body = (await c.req.json().catch(() => null)) as {
        order_id?: string;
        status?: string;
        amount?: number;
        payment_method?: string;
        completed_at?: string;
      } | null;
      if (!body?.order_id) return c.json({ error: 'order_id required' }, 400);

      const db = getDb();
      const now = Date.now();

      if (body.status === 'completed') {
        // Update payment + order status
        await db.execute({
          sql: "UPDATE payments SET status = 'completed', completed_at = ?, updated_at = ? WHERE order_id = ?",
          args: [now, now, body.order_id],
        });
        await db.execute({
          sql: "UPDATE orders SET payment_status = 'paid' WHERE id = ?",
          args: [body.order_id],
        });

        // Look up customer phone from the order to send WA confirmation
        const orderRow = await db.execute({
          sql: 'SELECT customer_phone FROM orders WHERE id = ?',
          args: [body.order_id],
        });
        if (orderRow.rows[0]) {
          const customerPhone = String(orderRow.rows[0].customer_phone);
          const jid = phoneToJid(customerPhone);
          const amountFormatted = body.amount
            ? `Rp ${body.amount.toLocaleString('id-ID')}`
            : '';
          const manager = getWhatsAppManager();
          await manager.sendMessageToJid(jid, {
            text: `✅ Pembayaran berhasil!\n\nOrder ID: ${body.order_id}\nJumlah: ${amountFormatted}\nMetode: ${body.payment_method ?? 'QRIS'}\n\nPesanan kamu akan segera diproses. Terima kasih!`,
          });
        }

        return c.json({ ok: true, status: 'completed' });
      }

      if (body.status === 'expired') {
        await db.execute({
          sql: "UPDATE payments SET status = 'expired', updated_at = ? WHERE order_id = ? AND status = 'pending'",
          args: [now, body.order_id],
        });
        return c.json({ ok: true, status: 'expired' });
      }

      return c.json({ ok: true });
    },
  }),
  registerApiRoute('/custom/pakasir/payment/:orderId', {
    method: 'GET',
    openapi: {
      summary: 'Get payment status from local DB for an order',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const orderId = c.req.query('orderId');
      if (!orderId) return c.json({ error: 'orderId required' }, 400);
      const db = getDb();
      const result = await db.execute({
        sql: `SELECT order_id, amount_idr, total_payment, payment_method, payment_number, status, expired_at, completed_at
              FROM payments WHERE tenant_id = ? AND order_id = ?`,
        args: [tenantId, orderId],
      });
      if (result.rows.length === 0) return c.json({ found: false }, 200);
      const r = result.rows[0]!;
      return c.json({
        found: true,
        orderId: String(r.order_id),
        amountIdr: Number(r.amount_idr),
        totalPayment: Number(r.total_payment),
        paymentMethod: String(r.payment_method),
        status: String(r.status),
        expiredAt: r.expired_at != null ? Number(r.expired_at) : null,
        completedAt: r.completed_at != null ? Number(r.completed_at) : null,
      });
    },
  }),
  registerApiRoute('/custom/agent-settings', {
    method: 'GET',
    openapi: {
      summary: 'Get agent settings (customer agent enabled, model)',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const db = getDb();
      const customerAgentEnabled = await getSetting(db, tenantId, 'customerAgentEnabled');
      const ownerModel = await getSetting(db, tenantId, 'ownerModel');
      return c.json({
        customerAgentEnabled: customerAgentEnabled !== 'false',
        ownerModel: ownerModel,
      });
    },
  }),
  registerApiRoute('/custom/agent-settings', {
    method: 'POST',
    openapi: {
      summary: 'Update agent settings',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const body = (await c.req.json().catch(() => null)) as {
        customerAgentEnabled?: boolean;
        ownerModel?: string;
      } | null;
      if (!body) return c.json({ error: 'Invalid JSON body' }, 400);
      const db = getDb();
      if (typeof body.customerAgentEnabled === 'boolean') {
        await setSetting(db, tenantId, 'customerAgentEnabled', String(body.customerAgentEnabled));
      }
      if (typeof body.ownerModel === 'string') {
        await setSetting(db, tenantId, 'ownerModel', body.ownerModel);
      }
      return c.json({ ok: true });
    },
  }),
  registerApiRoute('/custom/conversations', {
    method: 'GET',
    openapi: {
      summary: 'List all conversations for the tenant',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 200);
      const offset = parseInt(c.req.query('offset') ?? '0', 10);
      const db = getDb();
      const result = await db.execute({
        sql: `SELECT id, channel, customer_phone, customer_name, last_message_at, created_at
              FROM conversations
              WHERE tenant_id = ?
              ORDER BY last_message_at DESC
              LIMIT ? OFFSET ?`,
        args: [tenantId, limit, offset],
      });
      return c.json({
        conversations: result.rows.map((r) => ({
          id: Number(r.id),
          channel: String(r.channel),
          customerPhone: String(r.customer_phone),
          customerName: r.customer_name ? String(r.customer_name) : null,
          lastMessageAt: r.last_message_at != null ? Number(r.last_message_at) : null,
          createdAt: Number(r.created_at),
        })),
        total: result.rows.length,
      });
    },
  }),
  registerApiRoute('/custom/conversations/:phone', {
    method: 'GET',
    openapi: {
      summary: 'Get messages for a specific conversation by phone',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const phone = c.req.query('phone');
      if (!phone) return c.json({ error: 'phone required' }, 400);
      const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 200);
      const db = getDb();
      const result = await db.execute({
        sql: `SELECT id, channel, direction, content, created_at
              FROM messages
              WHERE tenant_id = ? AND customer_phone = ?
              ORDER BY created_at ASC
              LIMIT ?`,
        args: [tenantId, phone, limit],
      });
      return c.json({
        messages: result.rows.map((r) => ({
          id: Number(r.id),
          channel: String(r.channel),
          direction: String(r.direction),
          content: String(r.content),
          createdAt: Number(r.created_at),
        })),
      });
    },
  }),
  registerApiRoute('/custom/orders', {
    method: 'GET',
    openapi: {
      summary: 'List all orders for the tenant',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const status = c.req.query('status');
      const limit = Math.min(parseInt(c.req.query('limit') ?? '50', 10), 200);
      const db = getDb();
      let sql = `SELECT o.id, o.customer_phone, o.customer_name, o.amount_idr, o.status,
                       o.payment_status, o.created_at, o.updated_at,
                       c.name as contact_name
                FROM orders o
                LEFT JOIN contacts c ON o.customer_phone = c.phone AND o.tenant_id = c.tenant_id
                WHERE o.tenant_id = ?`;
      const args: (string | number)[] = [tenantId];
      if (status) {
        sql += ' AND o.status = ?';
        args.push(status);
      }
      sql += ' ORDER BY o.created_at DESC LIMIT ?';
      args.push(limit);
      const result = await db.execute({ sql, args });
      return c.json({
        orders: result.rows.map((r) => ({
          id: Number(r.id),
          customerPhone: String(r.customer_phone),
          customerName: r.customer_name ? String(r.customer_name) : r.contact_name ?? null,
          amountIdr: Number(r.amount_idr),
          status: String(r.status),
          paymentStatus: String(r.payment_status),
          createdAt: Number(r.created_at),
          updatedAt: Number(r.updated_at),
        })),
      });
    },
  }),
  registerApiRoute('/custom/dashboard/stats', {
    method: 'GET',
    openapi: {
      summary: 'Get dashboard statistics for the current tenant',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const db = getDb();

      const [ordersRow, revenueRow, conversationsRow] = await Promise.all([
        db.execute({
          sql: `SELECT status, COUNT(*) as cnt FROM orders WHERE tenant_id = ? GROUP BY status`,
          args: [tenantId],
        }),
        db.execute({
          sql: `SELECT COALESCE(SUM(total_idr), 0) as total FROM orders WHERE tenant_id = ? AND payment_status = 'paid'`,
          args: [tenantId],
        }),
        db.execute({
          sql: `SELECT COUNT(*) as cnt FROM conversations WHERE tenant_id = ?`,
          args: [tenantId],
        }),
      ]);

      const ordersByStatus: Record<string, number> = {};
      let totalOrders = 0;
      for (const row of ordersRow.rows) {
        const cnt = Number(row.cnt);
        ordersByStatus[String(row.status)] = cnt;
        totalOrders += cnt;
      }

      const recentOrdersRow = await db.execute({
        sql: `SELECT id, customer_phone, total_idr, status, payment_status, created_at
              FROM orders WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 5`,
        args: [tenantId],
      });

      return c.json({
        totalOrders,
        ordersByStatus,
        totalRevenueIdr: Number(revenueRow.rows[0]?.total ?? 0),
        totalConversations: Number(conversationsRow.rows[0]?.cnt ?? 0),
        recentOrders: recentOrdersRow.rows.map((r) => ({
          id: Number(r.id),
          customerPhone: String(r.customer_phone),
          totalIdr: Number(r.total_idr),
          status: String(r.status),
          paymentStatus: String(r.payment_status),
          createdAt: Number(r.created_at),
        })),
      });
    },
  }),
  registerApiRoute('/custom/dashboard/history', {
    method: 'GET',
    openapi: {
      summary: 'Get 7-day income/expense history',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const db = getDb();
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

      const rows = await db.execute({
        sql: `SELECT
                date(occurred_at/1000, 'unixepoch') as day,
                kind,
                SUM(amount_idr) as total
              FROM transactions
              WHERE tenant_id = ? AND occurred_at >= ?
              GROUP BY day, kind
              ORDER BY day ASC`,
        args: [tenantId, sevenDaysAgo],
      });

      // Build a map: day -> { income, expense }
      const byDay: Record<string, { income: number; expense: number }> = {};
      for (const row of rows.rows) {
        const day = String(row.day);
        const total = Number(row.total);
        if (!byDay[day]) byDay[day] = { income: 0, expense: 0 };
        if (String(row.kind) === 'income') byDay[day].income = total;
        else byDay[day].expense = total;
      }

      // Fill in all 7 days, even if no transactions
      const result = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now - i * 24 * 60 * 60 * 1000);
        const dayStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
        const entry = byDay[dayStr] ?? { income: 0, expense: 0 };
        result.push({
          day: dayStr,
          dayFormatted: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }),
          incomeIdr: entry.income,
          incomeFormatted: `Rp ${entry.income.toLocaleString('id-ID')}`,
          expenseIdr: entry.expense,
          expenseFormatted: `Rp ${entry.expense.toLocaleString('id-ID')}`,
          netIdr: entry.income - entry.expense,
          netFormatted: `Rp ${(entry.income - entry.expense).toLocaleString('id-ID')}`,
        });
      }

      return c.json({ history: result });
    },
  }),

  registerApiRoute('/custom/payment-simulate', {
    method: 'POST',
    openapi: {
      summary: 'Simulate payment completion (sandbox only)',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const body = (await c.req.json().catch(() => null)) as { orderId?: number } | null;
      if (!body?.orderId) return c.json({ error: 'orderId required' }, 400);

      const db = getDb();
      const now = Date.now();

      // Update payment status
      const paymentResult = await db.execute({
        sql: `SELECT id FROM payments WHERE tenant_id = ? AND order_id = ? AND status = 'pending'`,
        args: [tenantId, body.orderId],
      });

      if (paymentResult.rows.length === 0) {
        return c.json({ error: 'Payment not found or not pending' }, 404);
      }

      await db.execute({
        sql: "UPDATE payments SET status = 'completed', completed_at = ?, updated_at = ? WHERE order_id = ?",
        args: [now, now, body.orderId],
      });

      await db.execute({
        sql: "UPDATE orders SET payment_status = 'paid' WHERE id = ?",
        args: [body.orderId],
      });

      return c.json({ ok: true, message: `Payment simulation successful for order #${body.orderId}` });
    },
  }),
  registerApiRoute('/custom/documents', {
    method: 'GET',
    openapi: {
      summary: 'List generated documents in owner workspace',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const fs = ownerWorkspace.filesystem;
      if (!fs) return c.json({ documents: [] });

      const docs: { name: string; path: string; type: 'markdown' | 'text' }[] = [];
      try {
        // Look in common document locations
        const locations = [
          'files/documents',
          'files/proposals',
          'files/reports',
          'files',
        ];

        for (const loc of locations) {
          try {
            const entries = await fs.readdir(loc);
            for (const entry of entries) {
              if (entry.type === 'file') {
                const ext = entry.name.split('.').pop()?.toLowerCase();
                const type = ext === 'md' ? 'markdown' : 'text';
                docs.push({
                  name: entry.name,
                  path: `${loc}/${entry.name}`,
                  type,
                });
              }
            }
          } catch {
            // Skip locations that don't exist
          }
        }
      } catch {
        // Return empty on error
      }

      return c.json({ documents: docs });
    },
  }),
  registerApiRoute('/custom/documents/:path', {
    method: 'GET',
    openapi: {
      summary: 'Read a document by path',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const path = decodeURIComponent(c.req.query('path') || '');
      if (!path) return c.json({ error: 'path required' }, 400);
      if (!workspacePathSafe(path)) return c.json({ error: 'path escapes workspace' }, 403);

      const fs = ownerWorkspace.filesystem;
      if (!fs) return c.json({ error: 'no filesystem' }, 500);

      try {
        const content = await fs.readFile(path, { encoding: 'utf-8' });
        return c.json({
          path,
          content: typeof content === 'string' ? content : content.toString('utf-8'),
        });
      } catch {
        return c.json({ error: 'Document not found' }, 404);
      }
    },
  }),
  registerApiRoute('/custom/brand-assets', {
    method: 'GET',
    openapi: {
      summary: 'List brand design assets',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const fs = ownerWorkspace.filesystem;
      if (!fs) return c.json({ assets: [] });

      const assets: { name: string; path: string; type: 'css' | 'html' | 'json'; preview: string | null }[] = [];
      const locations = ['design-system', 'files/design'];

      for (const loc of locations) {
        try {
          const entries = await fs.readdir(loc);
          for (const entry of entries) {
            if (entry.type === 'file') {
              const ext = entry.name.split('.').pop()?.toLowerCase();
              if (['css', 'html', 'json'].includes(ext || '')) {
                assets.push({
                  name: entry.name,
                  path: `${loc}/${entry.name}`,
                  type: ext as 'css' | 'html' | 'json',
                  preview: null,
                });
              }
            }
          }
        } catch {
          // Skip
        }
      }

      return c.json({ assets });
    },
  }),
  registerApiRoute('/custom/brand-assets/:path', {
    method: 'GET',
    openapi: {
      summary: 'Read a brand asset file',
      tags: ['custom'],
    },
    handler: async (c) => {
      const authed = requireAuth(c);
      if (authed) return authed;
      const path = decodeURIComponent(c.req.query('path') || '');
      if (!path) return c.json({ error: 'path required' }, 400);
      if (!workspacePathSafe(path)) return c.json({ error: 'path escapes workspace' }, 403);

      const fs = ownerWorkspace.filesystem;
      if (!fs) return c.json({ error: 'no filesystem' }, 500);

      try {
        const content = await fs.readFile(path, { encoding: 'utf-8' });
        return c.json({
          content: typeof content === 'string' ? content : content.toString('utf-8'),
        });
      } catch {
        return c.json({ error: 'Asset not found' }, 404);
      }
    },
  }),
];
