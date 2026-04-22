import { useEffect, useState } from 'react';

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function CustomersTable() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/custom/customers')
      .then((r) => r.json())
      .then((d: { customers: Customer[] }) => {
        setCustomers(d.customers);
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
        <h3 className="text-sm font-semibold text-stone-900">Customers</h3>
        <span className="text-xs text-stone-400">{customers.length} contacts</span>
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
      ) : customers.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-400">No customers</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs uppercase tracking-wide text-stone-400">
                <th className="pb-2">Name</th>
                <th className="pb-2">Phone</th>
                <th className="pb-2">Email</th>
                <th className="pb-2">Notes</th>
                <th className="pb-2">Since</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {customers.map((c) => (
                <tr key={c.id} className="text-stone-700">
                  <td className="py-2 font-medium text-stone-900">{c.name}</td>
                  <td className="py-2 text-stone-500">{c.phone ?? '—'}</td>
                  <td className="py-2 text-stone-500">{c.email ?? '—'}</td>
                  <td className="py-2 text-stone-400 truncate max-w-32">{c.notes ?? '—'}</td>
                  <td className="py-2 text-xs text-stone-400">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
