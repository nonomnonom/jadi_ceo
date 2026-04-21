const AGENT_ID = 'juragan';

async function executeTool<Out>(toolId: string, input: unknown): Promise<Out> {
  const res = await fetch(`/api/agents/${AGENT_ID}/tools/${toolId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: input }),
  });
  if (!res.ok) {
    throw new Error(`${toolId}: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as Out;
}

export type DailySummary = {
  dayStart: number;
  dayEnd: number;
  incomeIdr: number;
  incomeFormatted: string;
  expenseIdr: number;
  expenseFormatted: string;
  netIdr: number;
  netFormatted: string;
  noteCount: number;
  pendingReminderCount: number;
};

export type InvoiceListItem = {
  id: number;
  contactName: string | null;
  amountFormatted: string;
  status: 'pending' | 'paid' | 'overdue';
  dueAt: number | null;
};

export type ProductListItem = {
  id: number;
  name: string;
  stockQty: number;
  lowStockAt: number;
  isLowStock: boolean;
};

export function getDailySummary(): Promise<DailySummary> {
  return executeTool<DailySummary>('get-daily-summary', {});
}

export function getOverdueInvoices(): Promise<{
  invoices: InvoiceListItem[];
  totalOutstandingFormatted: string;
}> {
  return executeTool('list-invoices', { status: 'overdue', limit: 10 });
}

export function getLowStock(): Promise<{ products: ProductListItem[] }> {
  return executeTool('list-products', { lowStockOnly: true, limit: 10 });
}

// ---- Agent metadata ----

export type AgentInfo = {
  id: string;
  name: string;
  description?: string;
  modelId?: string;
  provider?: string;
  tools: Record<string, unknown>;
  workspaceTools: Array<{ name: string } | string>;
  skills: Array<{ name: string; description?: string }>;
  workspaceId?: string;
};

export async function getAgent(): Promise<AgentInfo> {
  const res = await fetch(`/api/agents/${AGENT_ID}`);
  if (!res.ok) throw new Error(`agent info: ${res.status}`);
  return (await res.json()) as AgentInfo;
}

// ---- Workspace files ----

type FsEntry = { name: string; path: string; kind: 'file' | 'directory'; size?: number };

export async function listWorkspaceFiles(path = '/'): Promise<{ entries: FsEntry[] }> {
  const res = await fetch(`/custom/workspace/files?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`list files: ${res.status} ${await res.text()}`);
  return (await res.json()) as { entries: FsEntry[] };
}

export async function readWorkspaceFile(path: string): Promise<{ content: string }> {
  const res = await fetch(`/custom/workspace/file?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`read file: ${res.status} ${await res.text()}`);
  return (await res.json()) as { content: string };
}

// ---- Settings ----

export type SettingsStatus = {
  openrouterApiKey: string | null;
  telegramBotToken: string | null;
  configured: boolean;
  envHasOpenRouter: boolean;
};

export async function getSettings(): Promise<SettingsStatus> {
  const res = await fetch('/custom/settings');
  if (!res.ok) throw new Error(`settings: ${res.status}`);
  return (await res.json()) as SettingsStatus;
}

export async function saveSettings(body: {
  openrouterApiKey?: string;
  telegramBotToken?: string;
}): Promise<{ saved: string[]; restartRequired: boolean }> {
  const res = await fetch('/custom/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`save settings: ${res.status} ${await res.text()}`);
  return (await res.json()) as { saved: string[]; restartRequired: boolean };
}

// ---- Telegram ----

export type TelegramBot = { id: number; username: string; firstName: string };

export type TelegramTestResult = { ok: true; bot: TelegramBot } | { ok: false; error: string };

export async function testTelegramToken(token: string): Promise<TelegramTestResult> {
  const res = await fetch('/custom/telegram/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return (await res.json()) as TelegramTestResult;
}

export type TelegramStatus =
  | { configured: false; note: string }
  | { configured: true; botReachable: false; error: string }
  | { configured: true; botReachable: true; bot: TelegramBot; deepLink: string };

export async function getTelegramStatus(): Promise<TelegramStatus> {
  const res = await fetch('/custom/telegram/status');
  if (!res.ok) throw new Error(`telegram status: ${res.status}`);
  return (await res.json()) as TelegramStatus;
}
