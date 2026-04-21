import { describe, it, expect } from 'vitest';
import { runTool } from '../run-tool.js';

describe('OwnerSupervisor', () => {
  it('has id owner-supervisor', async () => {
    const { ownerSupervisor } = await import('../../src/mastra/agents/owner-supervisor.js');
    expect(ownerSupervisor.id).toBe('owner-supervisor');
  });

  it('has name Owner Supervisor', async () => {
    const { ownerSupervisor } = await import('../../src/mastra/agents/owner-supervisor.js');
    expect(ownerSupervisor.name).toBe('Owner Supervisor');
  });

  it('uses the correct model', async () => {
    const { ownerSupervisor } = await import('../../src/mastra/agents/owner-supervisor.js');
    expect(ownerSupervisor.model).toBe('openrouter/anthropic/claude-sonnet-4-6');
  });
});

describe('Skill execution via trigger-skill', () => {
  it('trigger-skill stock-opname returns actual instructions, not placeholder', async () => {
    const { createSkillCommandTools } = await import('../../src/mastra/tools/owner/skill-commands.js');
    const { triggerSkill } = createSkillCommandTools({ db: {} as any, tenantId: 'default' });

    const result = await runTool(triggerSkill, { name: 'stock-opname' });

    expect(result.success).toBe(true);
    // The actual skill instructions should reference real tools like get-current-time, list-products
    expect(result.message).toMatch(/get-current-time|list-products|opname/i);
    // Should NOT contain placeholder text
    expect(result.message).not.toMatch(/masih dalam pengembangan|still in development|segera hadir/i);
  });

  it('trigger-skill daily-checkin returns actual instructions, not placeholder', async () => {
    const { createSkillCommandTools } = await import('../../src/mastra/tools/owner/skill-commands.js');
    const { triggerSkill } = createSkillCommandTools({ db: {} as any, tenantId: 'default' });

    const result = await runTool(triggerSkill, { name: 'daily-checkin' });

    expect(result.success).toBe(true);
    // The actual daily-checkin skill should reference get-daily-summary, list-invoices
    expect(result.message).toMatch(/get-daily-summary|list-invoices|ringkasan/i);
    expect(result.message).not.toMatch(/masih dalam pengembangan|still in development/i);
  });

  it('trigger-skill wa-blast mentions draft and owner confirmation', async () => {
    const { createSkillCommandTools } = await import('../../src/mastra/tools/owner/skill-commands.js');
    const { triggerSkill } = createSkillCommandTools({ db: {} as any, tenantId: 'default' });

    const result = await runTool(triggerSkill, { name: 'wa-blast' });

    expect(result.success).toBe(true);
    // wa-blast skill emphasizes drafts, not auto-send
    expect(result.message.toLowerCase()).toMatch(/draft|kirim|broadcast/i);
    expect(result.message).not.toMatch(/masih dalam pengembangan/i);
  });
});
