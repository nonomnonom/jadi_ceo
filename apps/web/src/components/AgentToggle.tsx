import { useEffect, useState } from 'react';

type AgentSettings = {
  customerAgentEnabled: boolean;
  ownerModel: string | null;
};

export function AgentToggle() {
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/custom/agent-settings')
      .then((r) => r.json())
      .then((d: AgentSettings) => {
        setSettings(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setLoading(false);
      });
  }, []);

  async function toggleAgent() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/custom/agent-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerAgentEnabled: !settings.customerAgentEnabled }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Failed to save');
      } else {
        setSettings((prev) => prev ? { ...prev, customerAgentEnabled: !prev.customerAgentEnabled } : null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="h-20 animate-pulse rounded-xl bg-stone-200" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-stone-900">Customer Agent</h3>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-stone-600">
            {settings?.customerAgentEnabled ? 'Agent is online' : 'Agent is offline'}
          </p>
          {settings?.ownerModel && (
            <p className="mt-1 text-xs text-stone-400">Model: {settings.ownerModel}</p>
          )}
        </div>
        <button
          onClick={toggleAgent}
          disabled={saving}
          className={`rounded-full px-4 py-2 text-sm font-medium transition ${
            settings?.customerAgentEnabled
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          } disabled:opacity-50`}
        >
          {saving ? 'Saving...' : settings?.customerAgentEnabled ? 'Disable' : 'Enable'}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}
    </div>
  );
}
