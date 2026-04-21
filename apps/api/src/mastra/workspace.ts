import { mkdirSync } from 'node:fs';
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

export function createOwnerWorkspace(tenantId: string): Workspace {
  const basePath = ownerWorkspaceBasePath(tenantId);
  mkdirSync(basePath, { recursive: true });
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
