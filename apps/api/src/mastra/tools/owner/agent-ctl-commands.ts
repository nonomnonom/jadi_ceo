import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { Db } from '../../../db/client.js';
import { getSetting, setSetting } from '../../../db/settings.js';

export type AgentCtlDeps = { db: Db; tenantId: string };

export function createAgentCtlTools({ db, tenantId }: AgentCtlDeps) {
  const getCustomerAgentStatus = createTool({
    id: 'get-customer-agent-status',
    description:
      'Cek status Customer Agent (enabled/disabled). Gunakan saat owner minta "/customer-agent status".',
    inputSchema: z.object({}),
    outputSchema: z.object({
      enabled: z.boolean(),
      statusText: z.string(),
    }),
    execute: async () => {
      const enabled = await getSetting(db, tenantId, 'customerAgentEnabled');
      const isEnabled = enabled === null || enabled === 'true';

      return {
        enabled: isEnabled,
        statusText: isEnabled
          ? '✅ Customer Agent AKTIF — auto-reply WhatsApp menyala'
          : '⛔ Customer Agent NONAKTIF — auto-reply WhatsApp mati',
      };
    },
  });

  const enableCustomerAgent = createTool({
    id: 'enable-customer-agent',
    description:
      'Aktifkan Customer Agent untuk auto-reply WhatsApp. Gunakan saat owner bilang "/customer-agent enable".',
    inputSchema: z.object({}),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
    execute: async () => {
      await setSetting(db, tenantId, 'customerAgentEnabled', 'true');
      return {
        success: true,
        message: '✅ Customer Agent diaktifkan. Auto-reply WhatsApp sekarang MENYALA.',
      };
    },
  });

  const disableCustomerAgent = createTool({
    id: 'disable-customer-agent',
    description:
      'Nonaktifkan Customer Agent (matikan auto-reply WhatsApp). Gunakan saat owner bilang "/customer-agent disable".',
    inputSchema: z.object({
      reason: z.string().max(200).optional().describe('Alasan nonaktifkan (opsional)'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
    execute: async ({ reason }) => {
      await setSetting(db, tenantId, 'customerAgentEnabled', 'false');
      const reasonText = reason ? `\nAlasan: ${reason}` : '';
      return {
        success: true,
        message: `⛔ Customer Agent dinonaktifkan. Auto-reply WhatsApp sekarang MATI.${reasonText}`,
      };
    },
  });

  const listRecentConversations = createTool({
    id: 'list-recent-conversations',
    description:
      'Lihat daftar percakapan customer WhatsApp terbaru. Gunakan saat owner minta "/customer-agent view-all" atau ingin melihat semua chat terakhir.',
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).default(10),
    }),
    outputSchema: z.object({
      conversations: z.array(
        z.object({
          phone: z.string(),
          lastMessage: z.string(),
          lastMessageAt: z.number().int(),
          lastMessageAtFormatted: z.string(),
          messageCount: z.number().int(),
        }),
      ),
    }),
    execute: async ({ limit }) => {
      const effectiveLimit = limit ?? 10;
      const result = await db.execute({
        sql: `SELECT customer_phone, message, created_at,
                      COUNT(*) OVER (PARTITION BY customer_phone) as msg_count
              FROM conversations
              WHERE tenant_id = ? AND channel = 'whatsapp'
              ORDER BY created_at DESC`,
        args: [tenantId],
      });

      // Deduplicate by phone, take most recent per phone
      const phoneMap = new Map<
        string,
        { phone: string; lastMessage: string; lastMessageAt: number; msgCount: number }
      >();

      for (const row of result.rows) {
        const phone = String(row.customer_phone);
        if (!phoneMap.has(phone)) {
          const ts = Number(row.created_at);
          phoneMap.set(phone, {
            phone,
            lastMessage: String(row.message).slice(0, 100),
            lastMessageAt: ts,
            msgCount: Number(row.msg_count),
          });
        }
        if (phoneMap.size >= effectiveLimit) break;
      }

      const conversations = Array.from(phoneMap.values())
        .map((c) => ({
          phone: c.phone,
          lastMessage: c.lastMessage,
          lastMessageAt: c.lastMessageAt,
          lastMessageAtFormatted: new Date(c.lastMessageAt).toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }),
          messageCount: c.msgCount,
        }))
        .sort((a, b) => b.lastMessageAt - a.lastMessageAt);

      return { conversations };
    },
  });

  return {
    getCustomerAgentStatus,
    enableCustomerAgent,
    disableCustomerAgent,
    listRecentConversations,
  };
}
