/**
 * YAML parser for workflow definitions.
 * Parses workflow.yaml into WorkflowDefinition objects.
 */

import type {
  WorkflowDefinition,
  TriggerConfig,
  StepConfig,
  TriggerType,
  StepType,
} from './types.js';

// We use Zod for parsing with validation
// YAML is loaded as a string and we do simple key-value parsing

interface RawWorkflow {
  id?: string;
  name?: string;
  description?: string;
  version?: number;
  trigger?: {
    type?: string;
    event?: string;
    cron?: string;
    interval?: number;
  };
  steps?: RawStep[];
}

interface RawStep {
  id?: string;
  type?: string;
  agent?: string;
  input?: Record<string, string>;
  action?: string;
  waitFor?: {
    type?: string;
    timeout?: number;
  };
  condition?: string;
  else?: RawStep;
  parallel?: RawStep[];
  foreach?: string;
  items?: string;
}

function assertString(val: unknown, field: string): string {
  if (typeof val !== 'string') {
    throw new Error(`Expected string for ${field}, got ${typeof val}`);
  }
  return val;
}

function parseValue(value: string): unknown {
  // Try boolean
  if (value === 'true') return true;
  if (value === 'false') return false;
  // Try number
  const num = Number(value);
  if (!Number.isNaN(num) && value.trim() !== '') return num;
  // String
  return value;
}

function parseScalar(value: string): unknown {
  return parseValue(value);
}

export function parseWorkflowDefinition(
  yaml: string,
  dirName: string,
): WorkflowDefinition {
  // Simple YAML parser — split by lines and parse key-value pairs
  const lines = yaml.split('\n');
  const raw = parseYamlDoc(lines);

  const id = (raw.id as string) ?? dirName;
  const name = assertString(raw.name ?? dirName, 'name');
  const description = String(raw.description ?? '');
  const version = Number(raw.version ?? 1);

  // Parse trigger
  const rawTrigger = raw.trigger as RawWorkflow['trigger'] | undefined;
  const trigger: TriggerConfig = {
    type: (rawTrigger?.type ?? 'manual') as TriggerType,
    event: rawTrigger?.event,
    cronExpr: rawTrigger?.cron,
    intervalSec: rawTrigger?.interval,
  };

  // Parse steps
  const rawSteps = raw.steps as RawStep[] | undefined;
  if (!rawSteps || !Array.isArray(rawSteps)) {
    throw new Error('workflow.yaml must have a "steps" array');
  }
  const steps = rawSteps.map((s) => parseStep(s));

  return {
    id,
    name,
    description,
    trigger,
    steps,
    version,
    isActive: true,
  };
}

function parseStep(raw: RawStep): StepConfig {
  const id = assertString(raw.id, 'step.id');
  const type = (raw.type ?? 'agent') as StepType;

  const step: StepConfig = { id, type };

  if (raw.agent) step.agent = raw.agent;
  if (raw.input) step.input = raw.input;
  if (raw.action) step.action = raw.action;
  if (raw.condition) step.condition = raw.condition;
  if (raw.foreach) step.foreach = raw.foreach;
  if (raw.items) step.items = raw.items;

  if (raw.waitFor) {
    step.waitFor = {
      type: (raw.waitFor.type ?? 'approval') as 'approval' | 'timeout' | 'webhook',
      timeout: raw.waitFor.timeout,
    };
  }

  if (raw.else) {
    step.else = parseStep(raw.else);
  }

  if (raw.parallel && Array.isArray(raw.parallel)) {
    step.parallel = raw.parallel.map(parseStep);
  }

  return step;
}

/**
 * Simple YAML parser for workflow documents.
 * Handles: scalar values, simple objects, lists of objects.
 * Does NOT handle: nested anchors, multi-document streams, complex structures.
 */
function parseYamlDoc(lines: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let i = 0;
  let currentKey = '';
  let currentIndent = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    // Skip blank lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      i++;
      continue;
    }

    const indent = line.search(/\S/);
    const isListItem = trimmed.startsWith('- ');

    if (isListItem) {
      // This is a list item
      const content = trimmed.slice(2).trim();
      const colonIdx = content.indexOf(':');
      let keyStr: string;
      let valueStr = '';

      if (colonIdx !== -1) {
        keyStr = content.slice(0, colonIdx).trim();
        valueStr = content.slice(colonIdx + 1).trim();
      } else {
        keyStr = content;
      }

      if (valueStr.trim()) {
        // Inline value: "- key: value"
        const list = (result[currentKey] as unknown[]) ?? [];
        if (Array.isArray(list)) {
          list.push(parseScalar(valueStr));
          result[currentKey] = list;
        }
      } else if (keyStr.includes('=')) {
        // "key=value" format ( Flow style)
        const eqIdx = keyStr.indexOf('=');
        const k = keyStr.slice(0, eqIdx).trim();
        const v = keyStr.slice(eqIdx + 1).trim();
        const list = (result[currentKey] as Record<string, string>[]) ?? [];
        list.push({ [k]: v });
        result[currentKey] = list;
      } else {
        // Start of a new list item
        currentKey = keyStr;
        currentIndent = indent + 2;
        const list: Record<string, unknown>[] = (result[currentKey] as Record<string, unknown>[]) ?? [];
        // Parse nested object on next lines
        i++;
        const nested = parseNestedObject(lines, i, currentIndent);
        list.push(nested.obj);
        result[currentKey] = list;
        i = nested.nextIndex;
        continue;
      }
      i++;
      continue;
    }

    // Key-value pair
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      i++;
      continue; // not a key-value line
    }

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();

    if (value && !value.startsWith('-')) {
      // Simple scalar value
      result[key] = parseScalar(value);
      i++;
      continue;
    }

    // Complex value — remember key and parse nested
    currentKey = key;
    currentIndent = indent;
    i++;

    if (value && value.startsWith('-')) {
      // Inline list: "key: - item1\n  - item2"
      const list: unknown[] = [];
      while (i < lines.length) {
        const itemLine = lines[i]!;
        const itemTrimmed = itemLine.trim();
        if (!itemTrimmed.startsWith('-')) break;
        const itemValue = itemTrimmed.slice(2).trim();
        if (itemValue) list.push(parseScalar(itemValue));
        i++;
      }
      result[key] = list;
    } else {
      // Parse nested object
      const nested = parseNestedObject(lines, i, indent + 2);
      result[key] = nested.obj;
      i = nested.nextIndex;
    }
  }

  return result;
}

function parseNestedObject(
  lines: string[],
  startIdx: number,
  baseIndent: number,
): { obj: Record<string, unknown>; nextIndex: number } {
  const obj: Record<string, unknown> = {};
  let i = startIdx;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      i++;
      continue;
    }

    const indent = line.search(/\S/);
    if (indent < baseIndent) break; // end of nested block

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      i++;
      continue;
    }

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();

    if (value) {
      obj[key] = parseScalar(value);
      i++;
      continue;
    }

    // Could be nested object or list
    i++;
    if (i >= lines.length) break;

    const nextLine = lines[i]!;
    const nextTrimmed = nextLine.trim();

    if (nextTrimmed.startsWith('-')) {
      // List of objects or scalars
      const list: unknown[] = [];
      while (i < lines.length) {
        const itemLine = lines[i]!;
        const itemTrimmed = itemLine.trim();
        if (!itemTrimmed.startsWith('-')) break;
        const itemValue = itemTrimmed.slice(2).trim();
        if (itemValue) list.push(parseScalar(itemValue));
        i++;
      }
      obj[key] = list;
    } else {
      // Nested object
      const nested = parseNestedObject(lines, i, baseIndent + 2);
      obj[key] = nested.obj;
      i = nested.nextIndex;
    }
  }

  return { obj, nextIndex: i };
}