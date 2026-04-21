import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export type SkillCommandDeps = { db: unknown; tenantId: string };

const SKILLS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../../skills');

function loadSkillInstructions(skillName: string): string | null {
  const skillPath = join(SKILLS_DIR, `${skillName}/SKILL.md`);
  if (!existsSync(skillPath)) {
    return null;
  }
  try {
    const content = readFileSync(skillPath, 'utf-8');
    // Strip YAML frontmatter
    const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n?/, '');
    return withoutFrontmatter.trim();
  } catch {
    return null;
  }
}

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
      const VALID_SKILLS = [
        'daily-checkin',
        'customer-followup',
        'price-calculation',
        'stock-opname',
        'supplier-order',
        'wa-blast',
        'invoice-reminder',
        'expense-claim',
      ];

      if (!VALID_SKILLS.includes(name)) {
        return {
          success: false,
          skillName: name,
          message: `Skill "${name}" tidak ditemukan. Ketik /skill untuk melihat daftar skill.`,
        };
      }

      const instructions = loadSkillInstructions(name);
      if (!instructions) {
        return {
          success: false,
          skillName: name,
          message: `Skill "${name}" tidak dapat dibaca.`,
        };
      }

      return {
        success: true,
        skillName: name,
        message: instructions,
      };
    },
  });

  return { listSkills, triggerSkill };
}
