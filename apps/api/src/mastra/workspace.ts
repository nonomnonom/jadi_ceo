import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalFilesystem, WORKSPACE_TOOLS, Workspace } from '@mastra/core/workspace';

const HERE = dirname(fileURLToPath(import.meta.url));
// HERE is `apps/api/src/mastra/` in dev (tsx/bun) and `apps/api/.mastra/output/` after
// `mastra build`. Both are two directories above `apps/api/`, so `../../` lands at the
// package root and skills/data are stable regardless of process.cwd().
const PACKAGE_ROOT = resolve(HERE, '../../');
const SKILLS_DIR = resolve(PACKAGE_ROOT, 'skills');
const DATA_ROOT = resolve(PACKAGE_ROOT, 'data');

export function ownerWorkspaceBasePath(tenantId: string): string {
  return resolve(DATA_ROOT, 'workspaces', tenantId, 'owner');
}

const DEFAULT_BRAND_CSS = `:root {
  /* Primary colors */
  --brand-primary: #1a1a2e;
  --brand-primary-light: #2d2d44;
  --brand-accent: #e94560;
  --brand-accent-light: #ff6b6b;

  /* Neutral colors */
  --brand-bg: #fafaf9;
  --brand-surface: #ffffff;
  --brand-text: #1c1917;
  --brand-text-muted: #78716c;

  /* Status colors */
  --brand-success: #22c55e;
  --brand-warning: #f59e0b;
  --brand-error: #ef4444;

  /* Spacing */
  --brand-radius-sm: 0.375rem;
  --brand-radius-md: 0.5rem;
  --brand-radius-lg: 0.75rem;
  --brand-radius-xl: 1rem;
}`;

const DEFAULT_BRAND_JSON = JSON.stringify(
  {
    name: 'Juragan',
    tagline: 'Asisten Bisnis Cerdas',
    colors: {
      primary: '#1a1a2e',
      accent: '#e94560',
      background: '#fafaf9',
      surface: '#ffffff',
      text: '#1c1917',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
    },
    fonts: {
      heading: 'Inter, system-ui, sans-serif',
      body: 'Inter, system-ui, sans-serif',
    },
    createdAt: new Date().toISOString(),
  },
  null,
  2
);

function initDesignSystem(basePath: string): void {
  const designDir = resolve(basePath, 'design-system');
  mkdirSync(designDir, { recursive: true });
  writeFileSync(resolve(designDir, 'brand.css'), DEFAULT_BRAND_CSS);
  writeFileSync(resolve(designDir, 'brand.json'), DEFAULT_BRAND_JSON);
}

export function createOwnerWorkspace(tenantId: string): Workspace {
  const basePath = ownerWorkspaceBasePath(tenantId);
  mkdirSync(basePath, { recursive: true });
  initDesignSystem(basePath);
  return new Workspace({
    filesystem: new LocalFilesystem({
      basePath,
      allowedPaths: [SKILLS_DIR],
    }),
    skills: [SKILLS_DIR],
    tools: {
      // Destructive / niche — off for single-agent safety. Re-enable selectively later.
      [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: { enabled: false },
      [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: { enabled: false },
      [WORKSPACE_TOOLS.FILESYSTEM.AST_EDIT]: { enabled: false },
      [WORKSPACE_TOOLS.FILESYSTEM.MKDIR]: { enabled: false },
      // Write is gated: owner must approve each save, and agent must read before overwriting.
      [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: {
        requireApproval: true,
        requireReadBeforeWrite: true,
      },
      // Grep can dump a lot of content into context — cap it.
      [WORKSPACE_TOOLS.FILESYSTEM.GREP]: { maxOutputTokens: 1500 },
      // No code in the workspace — language-server queries add noise with no value.
      [WORKSPACE_TOOLS.LSP.LSP_INSPECT]: { enabled: false },
    },
  });
}
