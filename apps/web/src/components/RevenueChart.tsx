import { useEffect, useState } from 'react';
import { type RevenueDay, getRevenueHistory } from '../lib/api.ts';

export function RevenueChart() {
  const [history, setHistory] = useState<RevenueDay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRevenueHistory()
      .then((d) => {
        setHistory(d.history);
        setLoading(false);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="mb-3 h-4 w-32 animate-pulse rounded bg-stone-200" />
        <div className="flex items-end gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 animate-pulse rounded bg-stone-200" style={{ height: `${40 + Math.random() * 60}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !history) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-stone-900">Pemasukan vs Pengeluaran</h3>
        <p className="text-xs text-stone-400">Tidak dapat memuat data chart.</p>
      </div>
    );
  }

  // Find max for scaling
  const maxVal = Math.max(...history.map((d) => Math.max(d.incomeIdr, d.expenseIdr, 1)));

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-stone-900">Pemasukan vs Pengeluaran</h3>
        <span className="text-xs text-stone-400">7 hari terakhir</span>
      </div>

      {history.every((d) => d.incomeIdr === 0 && d.expenseIdr === 0) ? (
        <p className="py-4 text-center text-sm text-stone-400">Belum ada data transaksi.</p>
      ) : (
        <div className="flex items-end gap-1.5">
          {history.map((d) => {
            const incomeH = Math.max(4, Math.round((d.incomeIdr / maxVal) * 100));
            const expenseH = Math.max(4, Math.round((d.expenseIdr / maxVal) * 100));
            return (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-0.5">
                {/* Income bar */}
                <div className="w-full" title={`Pemasukan: ${d.incomeFormatted}`}>
                  <div
                    className="rounded-t bg-emerald-400 transition-all hover:bg-emerald-500"
                    style={{ height: `${incomeH}px`, width: '100%' }}
                  />
                </div>
                {/* Expense bar */}
                <div className="w-full" title={`Pengeluaran: ${d.expenseFormatted}`}>
                  <div
                    className="rounded-t bg-stone-300 transition-all hover:bg-stone-400"
                    style={{ height: `${expenseH}px`, width: '100%' }}
                  />
                </div>
                {/* Day label */}
                <span className="text-[9px] text-stone-400">{d.dayFormatted.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-stone-500">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-emerald-400" />
          Pemasukan
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-stone-300" />
          Pengeluaran
        </span>
      </div>
    </div>
  );
}
