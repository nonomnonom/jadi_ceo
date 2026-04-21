/**
 * Command parser and registry for slash commands.
 * Provides reliable command parsing and registration for Telegram owner commands.
 */

export interface ParsedCommand {
  command: string;
  args: string[];
}

/**
 * Parse a command string into command name and arguments.
 * Handles slash commands like "/order list", "/order approve 123", etc.
 */
export function parseCommand(text: string): ParsedCommand | null {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }

  // Get everything after the leading slash
  const afterSlash = trimmed.slice(1).trim();
  if (!afterSlash) {
    return null;
  }

  // Split on whitespace to get command and args
  const parts = afterSlash.split(/\s+/);
  const command = parts[0]!;
  const args = parts.slice(1);

  return { command, args };
}

export type CommandHandler = (args: string[]) => Promise<unknown> | unknown;

export interface CommandRegistry {
  register(command: string, handler: CommandHandler): void;
  getHandler(command: string): CommandHandler | undefined;
  listCommands(): string[];
  execute(command: string, args: string[]): Promise<unknown>;
}

export function createCommandRegistry(): CommandRegistry {
  const handlers = new Map<string, CommandHandler>();

  return {
    register(command: string, handler: CommandHandler): void {
      handlers.set(command.toLowerCase(), handler);
    },

    getHandler(command: string): CommandHandler | undefined {
      return handlers.get(command.toLowerCase());
    },

    listCommands(): string[] {
      return Array.from(handlers.keys());
    },

    async execute(command: string, args: string[]): Promise<unknown> {
      const handler = this.getHandler(command);
      if (!handler) {
        throw new Error(`Unknown command: /${command}`);
      }
      return handler(args);
    },
  };
}
