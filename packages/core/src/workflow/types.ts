/**
 * Phase 5: Workflow System 2.0 — Core types
 */

// Trigger types
export type TriggerType = 'event' | 'schedule' | 'manual' | 'webhook';

export interface TriggerConfig {
  type: TriggerType;
  // For event triggers
  event?: string;
  // For schedule triggers
  cronExpr?: string;
  intervalSec?: number;
}

// Step types
export type StepType = 'agent' | 'action' | 'wait' | 'condition' | 'parallel' | 'foreach';

export interface WaitConfig {
  type: 'approval' | 'timeout' | 'webhook';
  timeout?: number; // ms
}

export interface StepConfig {
  id: string;
  type: StepType;
  // For agent steps
  agent?: string;
  input?: Record<string, string>;
  // For action steps
  action?: string;
  // For wait steps
  waitFor?: WaitConfig;
  // For condition steps
  condition?: string;
  else?: StepConfig;
  // For parallel steps
  parallel?: StepConfig[];
  // For foreach steps
  foreach?: string;
  items?: string;
}

// Workflow definition
export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  trigger: TriggerConfig;
  steps: StepConfig[];
  version: number;
  isActive: boolean;
}

// Workflow execution state
export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'suspended';
  triggerType: TriggerType;
  triggerData: unknown;
  currentStep: string | null;
  variables: Record<string, unknown>;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  error?: string;
}

// Workflow version record
export interface WorkflowVersion {
  id: number;
  workflowId: string;
  version: number;
  definition: string; // YAML content
  createdAt: number;
  isActive: boolean;
}