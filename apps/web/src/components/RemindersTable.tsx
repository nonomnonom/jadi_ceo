import { useEffect, useState } from 'react';

type Reminder = {
  id: number;
  content: string;
  remindAt: number;
  done: boolean;
  createdAt: number;
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelative(ts: number): string {
  const now = Date.now();
  const diff = ts - now;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (diff < 0) return 'Overdue';
  if (mins < 60) return `in ${mins}m`;
  if (hours < 24) return `in ${hours}h`;
  return `in ${days}d`;
}

export function RemindersTable() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/custom/reminders')
      .then((r) => r.json())
      .then((d: { reminders: Reminder[] }) => {
        setReminders(d.reminders);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setLoading(false);
      });
  }, []);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-900">Reminders</h3>
        <span className="text-xs text-stone-400">{reminders.length} items</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-stone-100" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : reminders.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-400">No reminders</p>
      ) : (
        <div className="space-y-2">
          {reminders.map((r) => (
            <div key={r.id} className="flex items-start gap-3 border-b border-stone-50 py-3 last:border-0">
              <div className="mt-0.5">
                <div className={`h-3 w-3 rounded-full ${r.done ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${r.done ? 'text-stone-400 line-through' : 'text-stone-900'}`}>
                  {r.content}
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-stone-400">
                  <span>Due {formatDate(r.remindAt)}</span>
                  {!r.done && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.remindAt < Date.now() ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {formatRelative(r.remindAt)}
                    </span>
                  )}
                  {r.done && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Done
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
