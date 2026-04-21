import { useState } from 'react';
import { Overview } from './components/Overview.tsx';
import { Settings } from './components/Settings.tsx';
import { Workspace } from './components/Workspace.tsx';
import { ChannelStatus } from './components/ChannelStatus.tsx';
import { AgentToggle } from './components/AgentToggle.tsx';
import { OrdersTable } from './components/OrdersTable.tsx';
import { ConversationsViewer } from './components/ConversationsViewer.tsx';

type Tab = 'overview' | 'workspace' | 'settings' | 'channels' | 'orders';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'channels', label: 'Channels' },
  { id: 'orders', label: 'Orders' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'settings', label: 'Settings' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col gap-5 p-4 md:p-8">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Juragan</h1>
          <p className="text-sm text-stone-500">
            Dashboard owner — kelola agent, lihat aktivitas bisnis, onboarding kredensial.
          </p>
        </div>
      </header>

      <nav className="flex gap-1 rounded-xl border border-stone-200 bg-white p-1">
        {TABS.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.id ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="min-h-0 flex-1">
        {tab === 'overview' && <Overview />}
        {tab === 'channels' && (
          <div className="flex flex-col gap-4">
            <ChannelStatus />
            <AgentToggle />
            <ConversationsViewer />
          </div>
        )}
        {tab === 'orders' && <OrdersTable />}
        {tab === 'workspace' && <Workspace />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  );
}
