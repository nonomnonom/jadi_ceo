import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, '../../skills');

interface SkillFrontmatter {
  name: string;
  description: string;
  version: string;
  tags: string[];
}

function parseFrontmatter(content: string): SkillFrontmatter | null {
  // Match YAML frontmatter between --- markers
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const yaml = match[1];
  const result: Record<string, unknown> = {};

  // Collect lines, handling multiline arrays
  const lines: string[] = [];
  for (const rawLine of yaml.split(/\r?\n/)) {
    const line = rawLine;
    // If line starts with whitespace and has dash, it's a continuation of array
    if (lines.length > 0 && (line.startsWith('  - ') || line.startsWith('\t- '))) {
      lines[lines.length - 1] += '\n' + line;
    } else {
      lines.push(line);
    }
  }

  for (const line of lines) {
    // Skip empty lines or comment lines
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: string | string[] = line.slice(colonIdx + 1).trim();

    if (value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((v) => v.trim());
    } else if (value.startsWith('- ')) {
      // Multiline array: collect all - items
      const items = value.split('\n').map((v) => v.replace(/^-\s*/, '').trim()).filter(Boolean);
      value = items;
    }

    result[key] = value;
  }

  if (!result.name || !result.description || !result.version || !result.tags) {
    return null;
  }

  return result as SkillFrontmatter;
}

function getAllSkillDirs(): string[] {
  try {
    return readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

describe('Skills directory structure', () => {
  it('should have all 8 skills (3 existing + 5 new)', () => {
    const skillDirs = getAllSkillDirs();
    const expectedSkills = [
      'daily-checkin',
      'customer-followup',
      'price-calculation',
      'stock-opname',
      'supplier-order',
      'wa-blast',
      'invoice-reminder',
      'expense-claim',
    ];

    for (const expected of expectedSkills) {
      expect(skillDirs, `Skill "${expected}" should exist`).toContain(expected);
    }
  });
});

describe('Skill: stock-opname', () => {
  const skillPath = join(SKILLS_DIR, 'stock-opname/SKILL.md');

  it('should have SKILL.md file', () => {
    expect(() => readFileSync(skillPath, 'utf-8'), 'stock-opname/SKILL.md should exist').not.toThrow();
  });

  it('should have valid YAML frontmatter', () => {
    const content = readFileSync(skillPath, 'utf-8');
    const fm = parseFrontmatter(content);
    expect(fm, 'stock-opname should have valid frontmatter').not.toBeNull();
    expect(fm!.name).toBe('stock-opname');
    expect(fm!.description).toBeTruthy();
    expect(fm!.version).toBe('1.0.0');
    expect(Array.isArray(fm!.tags)).toBe(true);
  });

  it('should have trigger keywords in description', () => {
    const content = readFileSync(skillPath, 'utf-8');
    const fm = parseFrontmatter(content);
    expect(fm!.description.toLowerCase()).toMatch(/stock|opname|stok/);
  });

  it('should have ## Urutan section', () => {
    const content = readFileSync(skillPath, 'utf-8');
    expect(content).toMatch(/##\s*Urutan/);
  });
});

describe('Skill: supplier-order', () => {
  const skillPath = join(SKILLS_DIR, 'supplier-order/SKILL.md');

  it('should have SKILL.md file', () => {
    expect(() => readFileSync(skillPath, 'utf-8'), 'supplier-order/SKILL.md should exist').not.toThrow();
  });

  it('should have valid YAML frontmatter', () => {
    const content = readFileSync(skillPath, 'utf-8');
    const fm = parseFrontmatter(content);
    expect(fm, 'supplier-order should have valid frontmatter').not.toBeNull();
    expect(fm!.name).toBe('supplier-order');
    expect(fm!.description).toBeTruthy();
    expect(fm!.version).toBe('1.0.0');
  });

  it('should have ## Urutan section', () => {
    const content = readFileSync(skillPath, 'utf-8');
    expect(content).toMatch(/##\s*Urutan/);
  });
});

describe('Skill: wa-blast', () => {
  const skillPath = join(SKILLS_DIR, 'wa-blast/SKILL.md');

  it('should have SKILL.md file', () => {
    expect(() => readFileSync(skillPath, 'utf-8'), 'wa-blast/SKILL.md should exist').not.toThrow();
  });

  it('should have valid YAML frontmatter', () => {
    const content = readFileSync(skillPath, 'utf-8');
    const fm = parseFrontmatter(content);
    expect(fm, 'wa-blast should have valid frontmatter').not.toBeNull();
    expect(fm!.name).toBe('wa-blast');
    expect(fm!.description).toBeTruthy();
    expect(fm!.version).toBe('1.0.0');
  });

  it('should emphasize drafts NOT auto-send', () => {
    const content = readFileSync(skillPath, 'utf-8');
    expect(content.toLowerCase()).toMatch(/draft| bukan |jangan.*kirim|tidak.*auto/);
  });
});

describe('Skill: invoice-reminder', () => {
  const skillPath = join(SKILLS_DIR, 'invoice-reminder/SKILL.md');

  it('should have SKILL.md file', () => {
    expect(() => readFileSync(skillPath, 'utf-8'), 'invoice-reminder/SKILL.md should exist').not.toThrow();
  });

  it('should have valid YAML frontmatter', () => {
    const content = readFileSync(skillPath, 'utf-8');
    const fm = parseFrontmatter(content);
    expect(fm, 'invoice-reminder should have valid frontmatter').not.toBeNull();
    expect(fm!.name).toBe('invoice-reminder');
    expect(fm!.description).toBeTruthy();
    expect(fm!.version).toBe('1.0.0');
  });

  it('should reference overdue invoices', () => {
    const content = readFileSync(skillPath, 'utf-8');
    expect(content.toLowerCase()).toMatch(/overdue|jatuh tempo|tagih/);
  });
});

describe('Skill: expense-claim', () => {
  const skillPath = join(SKILLS_DIR, 'expense-claim/SKILL.md');

  it('should have SKILL.md file', () => {
    expect(() => readFileSync(skillPath, 'utf-8'), 'expense-claim/SKILL.md should exist').not.toThrow();
  });

  it('should have valid YAML frontmatter', () => {
    const content = readFileSync(skillPath, 'utf-8');
    const fm = parseFrontmatter(content);
    expect(fm, 'expense-claim should have valid frontmatter').not.toBeNull();
    expect(fm!.name).toBe('expense-claim');
    expect(fm!.description).toBeTruthy();
    expect(fm!.version).toBe('1.0.0');
  });

  it('should have approval workflow', () => {
    const content = readFileSync(skillPath, 'utf-8');
    expect(content.toLowerCase()).toMatch(/approve|konfirmasi|owner/);
  });
});
