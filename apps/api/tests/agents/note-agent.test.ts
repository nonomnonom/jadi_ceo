import { describe, it, expect } from 'vitest';

describe('NoteAgent', () => {
  it('has id note-agent', async () => {
    const { noteAgent } = await import('../../src/mastra/agents/note-agent.js');
    expect(noteAgent.id).toBe('note-agent');
  });

  it('has name Note Agent', async () => {
    const { noteAgent } = await import('../../src/mastra/agents/note-agent.js');
    expect(noteAgent.name).toBe('Note Agent');
  });

  it('uses the correct model', async () => {
    const { noteAgent } = await import('../../src/mastra/agents/note-agent.js');
    expect(noteAgent.model).toBe('openrouter/anthropic/claude-sonnet-4-6');
  });
});
