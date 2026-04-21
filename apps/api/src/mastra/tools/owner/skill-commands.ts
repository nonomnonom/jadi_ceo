import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export type SkillCommandDeps = { db: unknown; tenantId: string };

export function createSkillCommandTools(_deps: SkillCommandDeps) {
  const listSkills = createTool({
    id: 'list-skills',
    description: 'Daftar semua skill yang tersedia. Gunakan saat owner minta "/skill" tanpa argumen.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      skills: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          trigger: z.array(z.string()),
        }),
      ),
    }),
    execute: async () => {
      const skills = [
        {
          name: 'daily-checkin',
          description: 'Ringkasan pagi — laporan rutin, cek invoice overdue, reminder.',
          trigger: ['ringkasan pagi', 'laporan hari ini', 'daily check'],
        },
        {
          name: 'customer-followup',
          description: 'Tagih customer belum bayar — bikin pesan WA penagihan.',
          trigger: ['tagih', 'nagih', 'belum bayar', 'piutang'],
        },
        {
          name: 'price-calculation',
          description: 'Hitung harga jual, HPP, margin, markup.',
          trigger: ['harga jual', 'hpp', 'margin', 'markup', 'hitung harga'],
        },
        {
          name: 'stock-opname',
          description: 'Cek stok fisik vs sistem — variance report.',
          trigger: ['stock opname', 'cek stok fisik', 'opname'],
        },
        {
          name: 'supplier-order',
          description: 'Draft PO ke supplier — cek stok, bikin purchase order.',
          trigger: ['po supplier', 'order ke supplier', 'purchase order'],
        },
        {
          name: 'wa-blast',
          description: 'Kirim pesan ke semua customer — draft dulu, baru kirim.',
          trigger: ['blast wa', 'kirim ke semua customer', 'broadcast'],
        },
        {
          name: 'invoice-reminder',
          description: 'Reminder invoice jatuh tempo — nagih customer.',
          trigger: ['reminder invoice', 'jatuh tempo', 'invoice overdue'],
        },
        {
          name: 'expense-claim',
          description: 'Claim biaya karyawan — submit, owner approve, catat.',
          trigger: ['expense claim', 'claim biaya', 'reimburse'],
        },
      ];

      return { skills };
    },
  });

  const triggerSkill = createTool({
    id: 'trigger-skill',
    description:
      'Jalankan skill tertentu. Gunakan saat owner minta "/skill [nama]" atau trigger phrases terdeteksi.',
    inputSchema: z.object({
      name: z.string().describe('Nama skill (contoh: "daily-checkin", "price-calculation")'),
      context: z.string().optional().describe('Konteks tambahan untuk skill'),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      skillName: z.string(),
      message: z.string(),
    }),
    execute: async ({ name, context: _context }) => {
      // Skill runner would execute the skill here
      // For now, return a placeholder message
      const skillMessages: Record<string, string> = {
        'daily-checkin': '📋 Daily check-in...\n\n• Laporan belum diimplementasi\n• Cek invoice overdue\n• Reminder aktif',
        'customer-followup': '📞 Customer follow-up...\n\n• Masih dalam pengembangan\n• Fitur penagihan akan segera hadir',
        'price-calculation': '🧮 Price calculation...\n\n• Masukkan: harga modal, margin yang diinginkan\n• Hitung otomatis harga jual',
        'stock-opname': '📦 Stock opname...\n\n• Masih dalam pengembangan\n• Fitur stock opname akan segera hadir',
        'supplier-order': '📝 Supplier order...\n\n• Masih dalam pengembangan\n• Fitur PO supplier akan segera hadir',
        'wa-blast': '📱 WA blast...\n\n• Masih dalam pengembangan\n• Fitur broadcast akan segera hadir',
        'invoice-reminder': '📅 Invoice reminder...\n\n• Masih dalam pengembangan\n• Fitur reminder akan segera hadir',
        'expense-claim': '💰 Expense claim...\n\n• Masih dalam pengembangan\n• Fitur claim akan segera hadir',
      };

      const message = skillMessages[name] || `Skill "${name}" tidak ditemukan. Ketik /skill untuk melihat daftar skill.`;

      return {
        success: name in skillMessages,
        skillName: name,
        message,
      };
    },
  });

  return { listSkills, triggerSkill };
}
