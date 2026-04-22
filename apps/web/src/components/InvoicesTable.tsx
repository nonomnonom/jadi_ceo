import { useEffect, useState } from 'react';

type Invoice = {
  id: number;
  contactId: number | null;
  contactName: string | null;
  amountIdr: number;
  description: string | null;
  dueAt: number | null;
  paidAt: number | null;
  isPaid: boolean;
  isOverdue: boolean;
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

export function InvoicesTable() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/custom/invoices')
      .then((r) => r.json())
      .then((d: { invoices: Invoice[] }) => {
        setInvoices(d.invoices);
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
        <h3 className="text-sm font-semibold text-stone-900">Invoices</h3>
        <span className="text-xs text-stone-400">{invoices.length} invoices</span>
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
      ) : invoices.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-400">No invoices</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs uppercase tracking-wide text-stone-400">
                <th className="pb-2">Invoice</th>
                <th className="pb-2">Customer</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {invoices.map((inv) => (
                <tr key={inv.id} className="text-stone-700">
                  <td className="py-2 font-medium text-stone-900">#{inv.id}</td>
                  <td className="py-2">{inv.contactName ?? '—'}</td>
                  <td className="py-2">{formatRupiah(inv.amountIdr)}</td>
                  <td className="py-2">
                    {inv.isPaid ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Paid
                      </span>
                    ) : inv.isOverdue ? (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                        Overdue
                      </span>
                    ) : inv.dueAt ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Pending
                      </span>
                    ) : (
                      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                        No due date
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-xs text-stone-400">
                    {inv.dueAt ? formatDate(inv.dueAt) : '—'}
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
