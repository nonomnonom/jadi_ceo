import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type {
  OpenClawPluginApi,
  PluginInstance,
  ChannelPlugin,
  ProviderPlugin,
  ToolDefinition,
  SkillManifest,
  PluginManifest,
} from '@juragan/plugin-sdk';
import { PluginManifestSchema, definePluginEntry } from '@juragan/plugin-sdk';

export interface DiscoveredPlugin {
  manifest: PluginManifest;
  entryPath: string;
}

export interface PluginApi {
  registerChannel(channel: ChannelPlugin): void;
  registerOutboundChannel(channel: ChannelPlugin): void;
  registerProvider(provider: ProviderPlugin): void;
  registerTool(tool: ToolDefinition): void;
  registerCommand(def: {
    name: string;
    description: string;
    handler: (args: string | undefined, ctx: {
      tenantId: string;
      channel: string;
      chatId: string;
      userId?: string;
    }) => Promise<{ text?: string; error?: string }>;
  }): void;
  registerSkill(skill: SkillManifest): void;
  registerSettings(schema: z.ZodSchema, defaults: unknown): void;
  getSetting<T>(key: string): T;
  on(event: string, handler: (data: unknown) => void): void;
  emit(event: string, data: unknown): void;
}

const MAX_PLUGIN_DEPTH = 3;

class PluginManagerImpl {
  private plugins = new Map<string, PluginInstance>();
  private channels: ChannelPlugin[] = [];
  private providers: ProviderPlugin[] = [];
  private tools: ToolDefinition[] = [];
  private skills: SkillManifest[] = [];
  private settings = new Map<string, { schema: z.ZodSchema; defaults: unknown }>();
  private events = new Map<string, Set<(data: unknown) => void>>();

  async discover(directories: string[]): Promise<DiscoveredPlugin[]> {
    const discovered: DiscoveredPlugin[] = [];
    for (const dir of directories) {
      await this.scanDirectory(dir, discovered, 0);
    }
    return discovered;
  }

  private async scanDirectory(
    dir: string,
    discovered: DiscoveredPlugin[],
    depth: number,
  ): Promise<void> {
    if (depth > MAX_PLUGIN_DEPTH) return;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const manifestPath = join(dir, entry.name, 'juragan-plugin.json');
        let manifest: PluginManifest | null = null;
        try {
          const content = await fs.readFile(manifestPath, 'utf-8');
          const parsed = JSON.parse(content);
          manifest = PluginManifestSchema.parse(parsed);
        } catch {
          if (entry.name === 'plugins' || entry.name === 'node_modules') {
            await this.scanDirectory(join(dir, entry.name), discovered, depth + 1);
          }
          continue;
        }
        discovered.push({
          manifest,
          entryPath: join(dir, entry.name),
        });
      }
    } catch {
      // Directory doesn't exist
    }
  }

  async load(id: string, entryPath: string): Promise<PluginInstance> {
    if (this.plugins.has(id)) {
      return this.plugins.get(id)!;
    }

    const api = this.createApi();
    const mod = await import(entryPath);
    const entryFn = mod.default ?? mod;
    if (typeof entryFn !== 'function') {
      throw new Error(`[plugin-manager] ${id}: default export is not a function`);
    }
    const wrapped = definePluginEntry(
      { id, name: id, version: '0.0.0' },
      entryFn as (api: OpenClawPluginApi) => Promise<void> | void,
    );
    await wrapped(api);

    const instance: PluginInstance = {
      manifest: PluginManifestSchema.parse({ id }),
      api,
    };
    this.plugins.set(id, instance);
    return instance;
  }

  async unload(id: string): Promise<void> {
    const instance = this.plugins.get(id);
    if (!instance) return;
    if (instance.dispose) {
      await instance.dispose();
    }
    this.plugins.delete(id);
    this.channels = this.channels.filter((c) => !c.id.startsWith(`${id}:`));
    this.providers = this.providers.filter((p) => !p.id.startsWith(`${id}:`));
    this.tools = this.tools.filter((t) => !t.id.startsWith(`${id}:`));
    this.skills = this.skills.filter((s) => !s.id.startsWith(`${id}:`));
  }

  getChannels(): ChannelPlugin[] {
    return [...this.channels];
  }

  getProviders(): ProviderPlugin[] {
    return [...this.providers];
  }

  getTools(): ToolDefinition[] {
    return [...this.tools];
  }

  getSkills(): SkillManifest[] {
    return [...this.skills];
  }

  /** Discover skills from the skills/ directory (auto-loaded built-in skills). */
  async discoverSkills(skillsDir: string): Promise<SkillManifest[]> {
    try {
      const entries = await fs.readdir(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillPath = join(skillsDir, entry.name, 'SKILL.md');
        try {
          const content = await fs.readFile(skillPath, 'utf-8');
          const manifest = parseSkillFrontmatter(content);
          if (manifest) {
            // Avoid duplicates if skill was registered via plugin
            if (!this.skills.some((s) => s.id === manifest.id)) {
              this.skills.push(manifest);
            }
          }
        } catch {
          // Skill without SKILL.md or unreadable — skip
        }
      }
    } catch {
      // skills dir doesn't exist
    }
    return [...this.skills];
  }

  private createApi(): OpenClawPluginApi {
    const self = this;
    return {
      registerChannel(channel: ChannelPlugin) {
        self.channels.push(channel);
      },
      registerOutboundChannel(channel: ChannelPlugin) {
        self.channels.push(channel);
      },
      registerProvider(provider: ProviderPlugin) {
        self.providers.push(provider);
      },
      registerTool(tool: ToolDefinition) {
        self.tools.push(tool);
      },
      registerCommand(def) {
        self.tools.push({
          id: `cmd:${def.name}`,
          name: def.name,
          description: def.description,
          inputSchema: z.object({ args: z.string().optional() }),
          handler: (input) =>
            def.handler((input as { args?: string })?.args ?? undefined, {
              tenantId: '',
              channel: '',
              chatId: '',
            }),
        });
      },
      registerSkill(skill: SkillManifest) {
        self.skills.push(skill);
      },
      registerSettings(schema: z.ZodSchema, defaults: unknown) {
        self.settings.set('__plugin_settings', { schema, defaults });
      },
      getSetting<T>(_key: string): T {
        return (self.settings.get('__plugin_settings')?.defaults as T) ?? (null as T);
      },
      on(event: string, handler: (data: unknown) => void) {
        if (!self.events.has(event)) {
          self.events.set(event, new Set());
        }
        self.events.get(event)!.add(handler);
      },
      emit(event: string, data: unknown) {
        self.events.get(event)?.forEach((h) => h(data));
      },
    };
  }
}

/**
 * Parse YAML frontmatter from a SKILL.md file into a SkillManifest.
 */
function parseSkillFrontmatter(content: string): SkillManifest | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;

  const raw: Record<string, unknown> = {};
  for (const line of match[1]!.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      // Parse inline array: "  - item1\n  - item2"
      raw[key] = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      raw[key] = val;
    }
  }

  if (!raw.name || !raw.description) return null;

  return {
    id: String(raw.name).replace(/\s+/g, '-').toLowerCase(),
    name: String(raw.name),
    description: String(raw.description),
    emoji: raw.emoji ? String(raw.emoji) : undefined,
    tools: Array.isArray(raw.tools) ? raw.tools.map(String) : [],
    triggers: Array.isArray(raw.triggers) ? raw.triggers.map(String) : [],
    instructions: content.replace(/^---[\s\S]*?---\n/, '').trim(),
  };
}

let _manager: PluginManagerImpl | null = null;

export function getPluginManager(): PluginManagerImpl {
  if (!_manager) {
    _manager = new PluginManagerImpl();
  }
  return _manager;
}
