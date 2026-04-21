import { describe, it, expect, vi } from 'vitest';
import {
  parseCommand,
  CommandRegistry,
  createCommandRegistry,
} from '../../src/commands/parser.js';

describe('parseCommand', () => {
  it('parses /order list command', () => {
    const result = parseCommand('/order list');
    expect(result).toEqual({ command: 'order', args: ['list'] });
  });

  it('parses /order approve with id', () => {
    const result = parseCommand('/order approve 123');
    expect(result).toEqual({ command: 'order', args: ['approve', '123'] });
  });

  it('parses /order reject with id and reason', () => {
    const result = parseCommand('/order reject 456 karena stok habis');
    expect(result).toEqual({ command: 'order', args: ['reject', '456', 'karena', 'stok', 'habis'] });
  });

  it('parses /customer view with phone number', () => {
    const result = parseCommand('/customer view +6281234567890');
    expect(result).toEqual({ command: 'customer', args: ['view', '+6281234567890'] });
  });

  it('parses /customer-agent status', () => {
    const result = parseCommand('/customer-agent status');
    expect(result).toEqual({ command: 'customer-agent', args: ['status'] });
  });

  it('parses /model without arguments', () => {
    const result = parseCommand('/model');
    expect(result).toEqual({ command: 'model', args: [] });
  });

  it('parses /model with model name', () => {
    const result = parseCommand('/model anthropic/claude-sonnet-4-6');
    expect(result).toEqual({ command: 'model', args: ['anthropic/claude-sonnet-4-6'] });
  });

  it('parses /memory search with query', () => {
    const result = parseCommand('/memory search nama supplier');
    expect(result).toEqual({ command: 'memory', args: ['search', 'nama', 'supplier'] });
  });

  it('parses /skill without arguments', () => {
    const result = parseCommand('/skill');
    expect(result).toEqual({ command: 'skill', args: [] });
  });

  it('parses /skill with skill name', () => {
    const result = parseCommand('/skill stock-opname');
    expect(result).toEqual({ command: 'skill', args: ['stock-opname'] });
  });

  it('returns null for empty string', () => {
    const result = parseCommand('');
    expect(result).toBeNull();
  });

  it('returns null for text without slash', () => {
    const result = parseCommand('hello there');
    expect(result).toBeNull();
  });

  it('returns null for just "/"', () => {
    const result = parseCommand('/');
    expect(result).toBeNull();
  });

  it('handles extra whitespace', () => {
    const result = parseCommand('  /order  list  ');
    expect(result).toEqual({ command: 'order', args: ['list'] });
  });

  it('handles mixed case commands', () => {
    const result = parseCommand('/ORDER LIST');
    expect(result).toEqual({ command: 'ORDER', args: ['LIST'] });
  });
});

describe('CommandRegistry', () => {
  it('registers and retrieves a command handler', () => {
    const registry = createCommandRegistry();
    const handler = vi.fn();

    registry.register('test', handler);
    expect(registry.getHandler('test')).toBe(handler);
  });

  it('returns undefined for unregistered command', () => {
    const registry = createCommandRegistry();
    expect(registry.getHandler('unknown')).toBeUndefined();
  });

  it('lists all registered commands', () => {
    const registry = createCommandRegistry();
    registry.register('cmd1', vi.fn());
    registry.register('cmd2', vi.fn());

    const commands = registry.listCommands();
    expect(commands).toContain('cmd1');
    expect(commands).toContain('cmd2');
  });

  it('executes a registered command with args', async () => {
    const registry = createCommandRegistry();
    const handler = vi.fn().mockResolvedValue({ success: true });
    registry.register('greet', handler);

    const result = await registry.execute('greet', ['world']);
    expect(handler).toHaveBeenCalledWith(['world']);
    expect(result).toEqual({ success: true });
  });

  it('throws for unregistered command execution', async () => {
    const registry = createCommandRegistry();
    await expect(registry.execute('unknown', [])).rejects.toThrow('Unknown command');
  });
});
