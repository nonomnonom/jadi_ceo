/**
 * Workflow YAML parser — converts workflow.yaml to WorkflowDefinition
 */

import { parseWorkflowDefinition } from './parser.js';

export { parseWorkflowDefinition } from './parser.js';

/**
 * Load all workflows from the workflows/ directory.
 * Returns a map of workflow ID -> WorkflowDefinition.
 */
export async function loadAllWorkflows(
  workflowsDir: string,
): Promise<Map<string, import('./types.js').WorkflowDefinition>> {
  const { readdir, readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const workflows = new Map<string, import('./types.js').WorkflowDefinition>();

  let entries: string[] = [];
  try {
    entries = await readdir(workflowsDir);
  } catch {
    return workflows; // dir doesn't exist
  }

  for (const entry of entries) {
    const yamlPath = join(workflowsDir, entry, 'workflow.yaml');
    try {
      const yaml = await readFile(yamlPath, 'utf-8');
      const wf = parseWorkflowDefinition(yaml, entry);
      workflows.set(wf.id, wf);
    } catch (err) {
      console.warn(`[workflow-loader] Failed to load workflow from ${yamlPath}:`, err);
    }
  }

  return workflows;
}