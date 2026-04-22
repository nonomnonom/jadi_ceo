import { useEffect, useState } from 'react';

type Transaction = {
  id: number;
  kind: 'income' | 'expense';
  amountIdr: number;
  description: string | null;
  occurredAt: number;
  createdAt: number;
};

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

type Filter = 'all' | 'income' | 'expense';

export function TransactionsTable() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    setLoading(true);
    const url = filter === 'all' ? '/custom/transactions' : `/custom/transactions?kind=${filter}`;
    fetch(url)
      .then((r) => r.json())
      .then((d: { transactions: Transaction[] }) => {
        setTransactions(d.transactions);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setLoading(false);
      });
  }, [filter]);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-900">Transactions</h3>
        <div className="flex gap-1">
          {(['all', 'income', 'expense'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                filter === f ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
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
      ) : transactions.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-400">No transactions</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs uppercase tracking-wide text-stone-400">
                <th className="pb-2">Date</th>
                <th className="pb-2">Description</th>
                <th className="pb-2">Type</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {transactions.map((t) => (
                <tr key={t.id} className="text-stone-700">
                  <td className="py-2 text-xs text-stone-400">{formatDate(t.occurredAt)}</td>
                  <td className="py-2">{t.description ?? '—'}</td>
                  <td className="py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        t.kind === 'income'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {t.kind}
                    </span>
                  </td>
                  <td className={`py-2 text-right font-medium ${t.kind === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {t.kind === 'expense' ? '-' : '+'}{formatRupiah(t.amountIdr)}
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
