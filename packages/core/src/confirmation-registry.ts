/**
 * Tool confirmation registry — manages pending action tool approvals.
 *
 * When an action tool requires owner confirmation, the pending request
 * is stored here. Owner approves/rejects via Telegram commands.
 */

export interface PendingApproval {
  id: string;
  toolId: string;
  toolName: string;
  input: unknown;
  requestedAt: number;
  requestedBy: string; // 'agent' or 'customer'
  channel: string;
  conversationId?: string;
  timeoutAt: number;
}

export interface ApprovalResult {
  approved: boolean;
  approvedAt?: number;
  rejectedAt?: number;
}

export type ApprovalHandler = (
  approvalId: string,
  approved: boolean,
  actor: string,
) => Promise<void>;

export interface ConfirmationRegistry {
  /**
   * Create a pending approval request. Returns the pending approval ID.
   */
  createPending(params: {
    toolId: string;
    toolName: string;
    input: unknown;
    requestedBy: string;
    channel: string;
    conversationId?: string;
    timeoutMs?: number;
  }): string;

  /**
   * Get a pending approval by ID.
   */
  getPending(approvalId: string): PendingApproval | undefined;

  /**
   * Approve a pending request.
   */
  approve(approvalId: string, actor: string): Promise<boolean>;

  /**
   * Reject a pending request.
   */
  reject(approvalId: string, actor: string): Promise<boolean>;

  /**
   * List all pending approvals for a channel/tenant.
   */
  listPending(channel?: string): PendingApproval[];

  /**
   * Check if a tool ID is trusted (skip confirmation).
   */
  isTrustedTool(toolId: string): boolean;

  /**
   * Set the trusted tools list.
   */
  setTrustedTools(toolIds: string[]): void;

  /**
   * Register a callback for approval state changes.
   */
  onApprovalChange(handler: ApprovalHandler): void;
}

const DEFAULT_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

let _registry: ConfirmationRegistryImpl | null = null;

export function getConfirmationRegistry(): ConfirmationRegistry {
  if (!_registry) {
    _registry = new ConfirmationRegistryImpl();
  }
  return _registry;
}

export function resetConfirmationRegistry(): void {
  _registry = null;
}

class ConfirmationRegistryImpl implements ConfirmationRegistry {
  private pending = new Map<string, PendingApproval>();
  private trustedTools: Set<string> = new Set();
  private handlers: ApprovalHandler[] = [];

  createPending(params: {
    toolId: string;
    toolName: string;
    input: unknown;
    requestedBy: string;
    channel: string;
    conversationId?: string;
    timeoutMs?: number;
  }): string {
    const id = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const pending: PendingApproval = {
      id,
      toolId: params.toolId,
      toolName: params.toolName,
      input: params.input,
      requestedAt: Date.now(),
      requestedBy: params.requestedBy,
      channel: params.channel,
      conversationId: params.conversationId,
      timeoutAt: Date.now() + timeoutMs,
    };
    this.pending.set(id, pending);
    return id;
  }

  getPending(approvalId: string): PendingApproval | undefined {
    const p = this.pending.get(approvalId);
    if (p && p.timeoutAt < Date.now()) {
      this.pending.delete(approvalId);
      return undefined;
    }
    return p;
  }

  async approve(approvalId: string, actor: string): Promise<boolean> {
    const p = this.pending.get(approvalId);
    if (!p) return false;
    this.pending.delete(approvalId);
    for (const h of this.handlers) {
      await h(approvalId, true, actor);
    }
    return true;
  }

  async reject(approvalId: string, actor: string): Promise<boolean> {
    const p = this.pending.get(approvalId);
    if (!p) return false;
    this.pending.delete(approvalId);
    for (const h of this.handlers) {
      await h(approvalId, false, actor);
    }
    return true;
  }

  listPending(channel?: string): PendingApproval[] {
    const now = Date.now();
    return Array.from(this.pending.values()).filter((p) => {
      if (p.timeoutAt < now) {
        this.pending.delete(p.id);
        return false;
      }
      if (channel && p.channel !== channel) return false;
      return true;
    });
  }

  isTrustedTool(toolId: string): boolean {
    return this.trustedTools.has(toolId);
  }

  setTrustedTools(toolIds: string[]): void {
    this.trustedTools = new Set(toolIds);
  }

  onApprovalChange(handler: ApprovalHandler): void {
    this.handlers.push(handler);
  }
}