/**
 * @juragan/plugin-sdk
 *
 * The ONLY canonical boundary between core and plugins.
 * Plugins import from this package to interact with Juragan core.
 *
 * Usage:
 * ```typescript
 * import { definePluginEntry, type OpenClawPluginApi } from '@juragan/plugin-sdk';
 *
 * export default definePluginEntry({
 *   id: 'my-plugin',
 *   name: 'My Plugin',
 *   version: '1.0.0',
 * }, (api) => {
 *   api.registerTool({ ... });
 *   api.registerChannel({ ... });
 * });
 * ```
 */

// Types — re-exported from sub-modules for a clean public API
export type {
  PluginManifest,
  PluginInstance,
  OpenClawPluginApi,
  ChannelPlugin,
  ChannelAdapters,
  ChannelMessagingAdapter,
  ChannelOutboundAdapter,
  ChannelStatusAdapter,
  ChannelPairingAdapter,
  ChannelAuthAdapter,
  ChannelLifecycleAdapter,
  ChannelStatus,
  IncomingMessage,
  MessagingOptions,
  ProviderPlugin,
  ResolveModelParams,
  StreamParams,
  StreamFn,
  ProviderMessage,
  ProviderStreamEvent,
  ProviderCredentials,
  ProviderPreparedAuth,
  ToolDefinition,
  ToolHandler,
  ToolContext,
  SkillManifest,
  CommandDefinition,
  CommandHandler,
  CommandContext,
  CommandResult,
  PluginEntryPoint,
  EventHandler,
  MemoryPlugin,
  MemoryType,
  MemoryEntry,
} from './types.js';

// Schemas
export { PluginManifestSchema, SkillManifestSchema } from './types.js';

// Factories
export { definePluginEntry } from './plugin-api.js';
