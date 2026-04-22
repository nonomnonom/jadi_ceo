import { useEffect, useState } from 'react';

type AuditRecord = {
  id: number;
  toolId: string;
  toolName: string;
  action: string;
  actor: string;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  status: 'success' | 'error' | 'rejected' | 'timeout' | 'pending';
  channel: string | null;
  conversationId: number | null;
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

export function AuditLogTable() {
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    fetch('/custom/audit-logs')
      .then((r) => r.json())
      .then((d: { records: AuditRecord[]; total: number }) => {
        setRecords(d.records);
        setTotal(d.total);
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
        <h3 className="text-sm font-semibold text-stone-900">Audit Logs</h3>
        <span className="text-xs text-stone-400">{total} records</span>
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
      ) : records.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-400">No audit records</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs uppercase tracking-wide text-stone-400">
                <th className="pb-2">Time</th>
                <th className="pb-2">Tool</th>
                <th className="pb-2">Action</th>
                <th className="pb-2">Actor</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {records.map((r) => (
                <tr key={r.id} className="text-stone-700">
                  <td className="py-2 text-xs text-stone-400 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                  <td className="py-2 font-medium text-stone-900">{r.toolName}</td>
                  <td className="py-2 text-stone-600">{r.action}</td>
                  <td className="py-2 text-stone-500">{r.actor}</td>
                  <td className="py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.status === 'success'
                          ? 'bg-emerald-100 text-emerald-700'
                          : r.status === 'error'
                          ? 'bg-rose-100 text-rose-700'
                          : r.status === 'rejected' || r.status === 'timeout'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
