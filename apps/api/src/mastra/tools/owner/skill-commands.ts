import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPluginManager } from '@juragan/core';

export type SkillCommandDeps = { db: unknown; tenantId: string };

// Resolve skills dir from owner-supervisor level: apps/api/src/mastra/tools/owner/
// Then ../../../../ → Juragan/
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
      // Ensure skills are discovered first (handles lazy init in tests)
      const manager = getPluginManager();
      if (manager.getSkills().length === 0) {
        await manager.discoverSkills(SKILLS_DIR);
      }
      const skills = manager.getSkills();
      return {
        skills: skills.map((s) => ({
          name: s.id,
          description: s.description,
          trigger: s.triggers,
        })),
      };
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
      const manager = getPluginManager();
      if (manager.getSkills().length === 0) {
        await manager.discoverSkills(SKILLS_DIR);
      }
      const skills = manager.getSkills();

      if (!skills.some((s) => s.id === name)) {
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
