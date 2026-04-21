import { useEffect, useState } from 'react';

type WhatsAppStatus = {
  connected: boolean;
  qr: string | null;
};

type TelegramStatus =
  | { configured: false; note: string }
  | { configured: true; botReachable: false; error: string }
  | { configured: true; botReachable: true; bot: { id: number; username: string; firstName: string }; deepLink: string };

export function ChannelStatus() {
  const [wa, setWa] = useState<WhatsAppStatus | null>(null);
  const [tg, setTg] = useState<TelegramStatus | null>(null);
  const [waLoading, setWaLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/custom/whatsapp/status')
      .then((r) => r.json())
      .then((d: WhatsAppStatus) => setWa(d))
      .catch(() => null);

    fetch('/custom/telegram/status')
      .then((r) => r.json())
      .then((d: TelegramStatus) => setTg(d))
      .catch(() => null);
  }, []);

  async function connectWA() {
    setWaLoading(true);
    setError(null);
    try {
      const res = await fetch('/custom/whatsapp/connect', { method: 'POST' });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? 'Connection failed');
      }
      // Refresh status
      const statusRes = await fetch('/custom/whatsapp/status');
      setWa(await statusRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed');
    } finally {
      setWaLoading(false);
    }
  }

  async function disconnectWA() {
    setWaLoading(true);
    try {
      await fetch('/custom/whatsapp/disconnect', { method: 'POST' });
      const res = await fetch('/custom/whatsapp/status');
      setWa(await res.json());
    } finally {
      setWaLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-stone-900">Channel Status</h3>
      <div className="flex flex-col gap-3 text-sm">
        {/* WhatsApp */}
        <div className="flex items-center justify-between rounded-lg border border-stone-100 p-3">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${wa?.connected ? 'bg-emerald-400' : 'bg-stone-300'}`} />
            <span className="font-medium text-stone-700">WhatsApp</span>
          </div>
          <div className="flex gap-2">
            {wa?.connected ? (
              <button
                onClick={disconnectWA}
                disabled={waLoading}
                className="rounded-lg px-3 py-1 text-xs font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-50"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={connectWA}
                disabled={waLoading}
                className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {waLoading ? 'Connecting...' : 'Connect'}
              </button>
            )}
          </div>
        </div>

        {/* Telegram */}
        <div className="flex items-center justify-between rounded-lg border border-stone-100 p-3">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${tg && tg.configured && tg.botReachable ? 'bg-emerald-400' : 'bg-stone-300'}`} />
            <span className="font-medium text-stone-700">Telegram</span>
          </div>
          <div>
            {tg?.configured && tg.botReachable ? (
              <a
                href={tg.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
              >
                Open {tg.bot.username}
              </a>
            ) : (
              <span className="text-xs text-stone-400">
                {tg?.configured === false ? 'Not configured' : tg?.configured && !tg.botReachable ? 'Bot unreachable' : 'Loading...'}
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}
    </div>
  );
}
