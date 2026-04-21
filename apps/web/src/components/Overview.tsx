import { useEffect, useState } from 'react';
import {
  type AgentInfo,
  type DailySummary,
  type DashboardStats,
  type InvoiceListItem,
  type ProductListItem,
  getAgent,
  getDailySummary,
  getDashboardStats,
  getLowStock,
  getOverdueInvoices,
} from '../lib/api.ts';

type State = {
  summary: DailySummary | null;
  dashboard: DashboardStats | null;
  overdue: { invoices: InvoiceListItem[]; totalOutstandingFormatted: string } | null;
  lowStock: { products: ProductListItem[] } | null;
  agent: AgentInfo | null;
  error: string | null;
  loading: boolean;
};

export function Overview() {
  const [s, setS] = useState<State>({
    summary: null,
    dashboard: null,
    overdue: null,
    lowStock: null,
    agent: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getDailySummary(),
      getDashboardStats(),
      getOverdueInvoices(),
      getLowStock(),
      getAgent(),
    ])
      .then(([summary, dashboard, overdue, lowStock, agent]) => {
        if (cancelled) return;
        setS({ summary, dashboard, overdue, lowStock, agent, error: null, loading: false });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Gagal memuat data';
        setS((prev) => ({ ...prev, error: message, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (s.loading) return <Skeleton />;
  if (s.error) return <ErrorBanner message={s.error} />;

  return (
    <div className="flex flex-col gap-5">
      <StatsGrid summary={s.summary} dashboard={s.dashboard} />
      <div className="grid gap-4 md:grid-cols-2">
        <OverdueCard overdue={s.overdue} />
        <LowStockCard lowStock={s.lowStock} />
      </div>
      <AgentCard agent={s.agent} />
    </div>
  );
}

function StatsGrid({
  summary,
  dashboard,
}: {
  summary: DailySummary | null;
  dashboard: DashboardStats | null;
}) {
  const pendingOrders = dashboard?.ordersByStatus?.pending ?? 0;
  const revenueFormatted = dashboard
    ? `Rp ${dashboard.totalRevenueIdr.toLocaleString('id-ID')}`
    : 'Rp 0';

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard
        label="Pemasukan hari ini"
        value={summary?.incomeFormatted ?? 'Rp 0'}
        tone="positive"
      />
      <StatCard
        label="Pengeluaran hari ini"
        value={summary?.expenseFormatted ?? 'Rp 0'}
        tone="neutral"
      />
      <StatCard
        label="Total revenue"
        value={revenueFormatted}
        tone="positive"
      />
      <StatCard
        label="Order pending"
        value={String(pendingOrders)}
        tone={pendingOrders > 0 ? 'warn' : 'positive'}
      />
    </div>
  );
}

function OverdueCard({ overdue }: { overdue: State['overdue'] }) {
  return (
    <Card title="Piutang overdue" subtitle={overdue?.totalOutstandingFormatted ?? 'Rp 0'}>
      {!overdue || overdue.invoices.length === 0 ? (
        <Empty>Tidak ada invoice yang lewat jatuh tempo. 👍</Empty>
      ) : (
        <ul className="flex flex-col divide-y divide-stone-100">
          {overdue.invoices.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between py-2 text-sm">
              <span className="truncate pr-3 text-stone-700">
                {inv.contactName ?? `Invoice #${inv.id}`}
              </span>
              <span className="whitespace-nowrap font-medium text-stone-900">
                {inv.amountFormatted}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LowStockCard({ lowStock }: { lowStock: State['lowStock'] }) {
  return (
    <Card title="Stok menipis" subtitle={`${lowStock?.products.length ?? 0} produk`}>
      {!lowStock || lowStock.products.length === 0 ? (
        <Empty>Semua produk stoknya aman. 📦</Empty>
      ) : (
        <ul className="flex flex-col divide-y divide-stone-100">
          {lowStock.products.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2 text-sm">
              <span className="truncate pr-3 text-stone-700">{p.name}</span>
              <span className="whitespace-nowrap text-stone-500">
                {p.stockQty} / {p.lowStockAt}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AgentCard({ agent }: { agent: AgentInfo | null }) {
  if (!agent) return null;
  const toolCount = Object.keys(agent.tools).length;
  const wsToolCount = agent.workspaceTools?.length ?? 0;
  const skillCount = agent.skills?.length ?? 0;
  return (
    <Card title="Agent" subtitle={agent.name}>
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-stone-600">{agent.description}</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Badge label="business tools" value={String(toolCount)} />
          <Badge label="workspace tools" value={String(wsToolCount)} />
          <Badge label="skills" value={String(skillCount)} />
        </div>
        {skillCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {agent.skills.map((sk) => (
              <span
                key={sk.name}
                className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-700"
              >
                {sk.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// ---- primitives ----

type Tone = 'positive' | 'neutral' | 'warn';

function StatCard({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  const toneClasses: Record<Tone, string> = {
    positive: 'border-emerald-200 bg-emerald-50',
    neutral: 'border-stone-200 bg-white',
    warn: 'border-amber-300 bg-amber-50',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClasses[tone]}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-stone-900">{value}</div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
        {subtitle ? <span className="text-xs text-stone-500">{subtitle}</span> : null}
      </div>
      {children}
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-stone-50 py-2">
      <div className="text-lg font-semibold text-stone-900">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-stone-500">{label}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-center text-sm text-stone-400">{children}</p>;
}

function Skeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
          <div key={i} className="h-20 animate-pulse rounded-xl bg-stone-200" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-48 animate-pulse rounded-2xl bg-stone-200" />
        <div className="h-48 animate-pulse rounded-2xl bg-stone-200" />
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      Gagal memuat: {message}. Pastikan server API jalan di <code>http://localhost:4111</code>.
    </div>
  );
}
