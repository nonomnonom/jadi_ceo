import { z } from 'zod';

/**
 * Plugin manifest schema — the contract between core and plugins.
 * Every plugin must have a juragan-plugin.json at its root.
 */
export const PluginManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional().default(''),
  channels: z
    .array(
      z.object({
        id: z.string().min(1),
        type: z.enum(['telegram', 'whatsapp', 'instagram', 'email', 'webhook']),
      })
    )
    .optional()
    .default([]),
  providers: z
    .array(
      z.object({
        id: z.string().min(1),
        type: z.enum(['openrouter', 'openai', 'anthropic', 'google']),
      })
    )
    .optional()
    .default([]),
  skills: z.array(z.string()).optional().default([]),
  tools: z.array(z.string()).optional().default([]),
  settingsFiles: z.array(z.string()).optional().default([]),
});

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

/**
 * The API surface provided to plugins during registration.
 * This is the ONLY canonical interface plugins can use to interact with core.
 */
export interface OpenClawPluginApi {
  // Channel registration
  registerChannel(channel: ChannelPlugin): void;
  registerOutboundChannel(channel: ChannelPlugin): void;

  // Provider registration
  registerProvider(provider: ProviderPlugin): void;

  // Tool registration
  registerTool(tool: ToolDefinition): void;
  registerCommand(command: CommandDefinition): void;

  // Skill registration
  registerSkill(skill: SkillManifest): void;

  // Settings
  registerSettings(schema: z.ZodSchema, defaults: unknown): void;
  getSetting<T>(key: string): T;

  // Runtime events
  on(event: string, handler: EventHandler): void;
  emit(event: string, data: unknown): void;
}

export interface CommandDefinition {
  name: string;
  nativeNames?: Partial<Record<string, string>>;
  description: string;
  acceptsArgs?: boolean;
  requireAuth?: boolean;
  handler: CommandHandler;
}

export type CommandHandler = (
  args: string | undefined,
  ctx: CommandContext
) => Promise<CommandResult>;

export interface CommandContext {
  tenantId: string;
  channel: string;
  userId?: string;
  chatId: string;
}

export interface CommandResult {
  text?: string;
  error?: string;
  markup?: unknown;
}

export type EventHandler = (data: unknown) => void;

/**
 * A loaded plugin instance — holds manifest + registered components.
 */
export interface PluginInstance {
  manifest: PluginManifest;
  api: OpenClawPluginApi;
  channels?: ChannelPlugin[];
  providers?: ProviderPlugin[];
  tools?: ToolDefinition[];
  dispose?: () => Promise<void>;
}

/**
 * Channel plugin type — registered via api.registerChannel().
 */
export interface ChannelPlugin {
  id: string;
  type: 'telegram' | 'whatsapp' | 'instagram' | 'email' | 'webhook';
  meta: {
    name: string;
    description?: string;
  };
  adapters: ChannelAdapters;
}

export interface ChannelAdapters {
  messaging?: ChannelMessagingAdapter;
  outbound?: ChannelOutboundAdapter;
  status?: ChannelStatusAdapter;
  pairing?: ChannelPairingAdapter;
  auth?: ChannelAuthAdapter;
  lifecycle?: ChannelLifecycleAdapter;
}

export interface ChannelMessagingAdapter {
  sendMessage(to: string, text: string, options?: MessagingOptions): Promise<void>;
  onMessage(handler: (message: IncomingMessage) => void): void;
}

export interface MessagingOptions {
  quotedMsgId?: string;
  mentions?: string[];
}

export interface IncomingMessage {
  id: string;
  from: string;
  body: string;
  timestamp: number;
  channel: string;
  meta?: Record<string, unknown>;
}

export interface ChannelOutboundAdapter {
  sendMessage(to: string, text: string, options?: MessagingOptions): Promise<void>;
}

export interface ChannelStatusAdapter {
  getStatus(): Promise<ChannelStatus>;
}

export type ChannelStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface ChannelPairingAdapter {
  getQRCode?(): Promise<string>; // base64 PNG
  startPairing?(): Promise<void>;
  stopPairing?(): Promise<void>;
}

export interface ChannelAuthAdapter {
  authenticate?(credentials: Record<string, unknown>): Promise<boolean>;
  logout?(): Promise<void>;
}

export interface ChannelLifecycleAdapter {
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
  onStatusChange?(handler: (status: ChannelStatus) => void): void;
}

/**
 * Provider plugin type — registered via api.registerProvider().
 */
export interface ProviderPlugin {
  id: string;
  type: 'openrouter' | 'openai' | 'anthropic' | 'google';
  meta: {
    name: string;
    description?: string;
  };

  // Model resolution
  resolveModel?(params: ResolveModelParams): string | null;
  normalizeModelId?(modelId: string): string;

  // Transport
  createStreamFn?(params: StreamParams): Promise<StreamFn>;
  wrapStreamFn?(params: StreamParams, fn: StreamFn): StreamFn;

  // Auth
  prepareAuth?(credentials: ProviderCredentials): ProviderPreparedAuth;
}

export interface ResolveModelParams {
  requestedModel?: string;
  fallbackChain?: string[];
}

export interface StreamParams {
  model: string;
  messages: ProviderMessage[];
  tools?: ToolDefinition[];
  signal?: AbortSignal;
}

export type StreamFn = (params: StreamParams) => Promise<AsyncGenerator<ProviderStreamEvent>>;

export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
}

export type ProviderStreamEvent =
  | { type: 'delta'; delta: string }
  | { type: 'done' }
  | { type: 'error'; error: string };

export interface ProviderCredentials {
  apiKey: string;
  baseUrl?: string;
}

export interface ProviderPreparedAuth {
  apiKey: string;
  baseUrl?: string;
}

/**
 * Tool plugin type — registered via api.registerTool().
 */
export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  outputSchema?: z.ZodSchema;
  handler: ToolHandler;
  category?: 'read' | 'write' | 'action' | 'admin';
  requireConfirmation?: boolean;
}

export type ToolHandler = (
  input: unknown,
  ctx: ToolContext
) => Promise<unknown>;

export interface ToolContext {
  tenantId: string;
  channel: string;
  userId?: string;
  conversationId?: string;
}

/**
 * Skill manifest — metadata for a skill attached to an agent.
 * Written as YAML frontmatter in skills/<skill-name>/SKILL.md
 */
export interface SkillManifest {
  id: string;
  name: string;
  description: string;
  emoji?: string;
  tools: string[]; // tool IDs this skill uses
  triggers: string[]; // keywords that trigger this skill
  instructions?: string; // additional system prompt content
}

export const SkillManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().default(''),
  emoji: z.string().optional(),
  tools: z.array(z.string()).default([]),
  triggers: z.array(z.string()).default([]),
  instructions: z.string().optional(),
});

// Re-export Zod for use by plugins
export { z };

/**
 * Plugin entry point signature.
 * All Juragan plugins must export a default function matching this signature.
 */
export interface PluginEntryPoint {
  (api: OpenClawPluginApi): Promise<void> | void;
}

export function definePluginEntry(
  manifest: {
    id: string;
    name: string;
    version: string;
    description?: string;
  },
  register: PluginEntryPoint
): PluginEntryPoint {
  // Validate manifest fields
  if (!manifest.id || !manifest.name || !manifest.version) {
    throw new Error(
      `[plugin-sdk] Plugin manifest must have id, name, and version`
    );
  }
  return register;
}
