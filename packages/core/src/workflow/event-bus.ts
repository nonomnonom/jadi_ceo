/**
 * Workflow Event Bus — pub/sub system for workflow triggers.
 *
 * Allows workflows to subscribe to domain events like:
 * - order.created, order.paid, order.cancelled
 * - payment.received, payment.expired
 * - stock.low, stock.critical
 * - invoice.overdue
 */

export type WorkflowEventType =
  | 'order.created'
  | 'order.approved'
  | 'order.rejected'
  | 'order.paid'
  | 'order.cancelled'
  | 'payment.received'
  | 'payment.expired'
  | 'stock.low'
  | 'stock.critical'
  | 'invoice.overdue'
  | 'reminder.due'
  | 'schedule.daily'
  | 'schedule.weekly';

export interface WorkflowEvent {
  type: WorkflowEventType;
  tenantId: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

export type EventHandler = (event: WorkflowEvent) => Promise<void> | void;

interface Subscription {
  id: string;
  eventType: WorkflowEventType | '*';
  handler: EventHandler;
}

class WorkflowEventBusImpl {
  private subscriptions: Subscription[] = [];
  private handlers: Map<string, EventHandler[]> = new Map();

  /**
   * Subscribe to a workflow event type.
   * Returns an unsubscribe function.
   */
  subscribe(eventType: WorkflowEventType | '*', handler: EventHandler): () => void {
    const id = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const sub: Subscription = { id, eventType, handler };

    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
    this.subscriptions.push(sub);

    return () => {
      const idx = this.subscriptions.findIndex((s) => s.id === id);
      if (idx !== -1) this.subscriptions.splice(idx, 1);
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        const hIdx = handlers.indexOf(handler);
        if (hIdx !== -1) handlers.splice(hIdx, 1);
      }
    };
  }

  /**
   * Emit an event to all subscribed handlers.
   */
  async emit(event: WorkflowEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? [];
    const wildcardHandlers = this.handlers.get('*') ?? [];
    const allHandlers = [...handlers, ...wildcardHandlers];

    await Promise.allSettled(allHandlers.map((h) => h(event)));
  }

  /**
   * Create a typed event emitter for a specific tenant.
   */
  forTenant(tenantId: string): TypedEventEmitter {
    return new TypedEventEmitter(this, tenantId);
  }
}

class TypedEventEmitter {
  constructor(
    private bus: WorkflowEventBusImpl,
    private tenantId: string,
  ) {}

  /**
   * Emit an event with the tenant automatically set.
   */
  async emit(type: WorkflowEventType, payload: Record<string, unknown> = {}): Promise<void> {
    const event: WorkflowEvent = {
      type,
      tenantId: this.tenantId,
      timestamp: Date.now(),
      payload,
    };
    await this.bus.emit(event);
  }

  /**
   * Subscribe to events for this tenant.
   */
  subscribe(handler: EventHandler): () => void {
    return this.bus.subscribe('*', handler);
  }

  /**
   * Subscribe to a specific event type.
   */
  subscribeTo(type: WorkflowEventType, handler: EventHandler): () => void {
    return this.bus.subscribe(type, handler);
  }
}

// Singleton event bus
let _eventBus: WorkflowEventBusImpl | null = null;

export function getWorkflowEventBus(): WorkflowEventBusImpl {
  if (!_eventBus) {
    _eventBus = new WorkflowEventBusImpl();
  }
  return _eventBus;
}

export function resetWorkflowEventBus(): void {
  _eventBus = null;
}

/**
 * Helper to emit a workflow event from anywhere in the codebase.
 */
export async function emitWorkflowEvent(
  type: WorkflowEventType,
  tenantId: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const event: WorkflowEvent = {
    type,
    tenantId,
    timestamp: Date.now(),
    payload,
  };
  await getWorkflowEventBus().emit(event);
}