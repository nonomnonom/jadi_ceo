import { useEffect, useState } from 'react';

type Order = {
  id: number;
  customerPhone: string;
  customerName: string | null;
  amountIdr: number;
  status: string;
  paymentStatus: string;
  createdAt: number;
};

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Filter = 'all' | 'pending' | 'paid' | 'cancelled';

export function OrdersTable() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const url = filter === 'all' ? '/custom/orders' : `/custom/orders?status=${filter}`;
    fetch(url)
      .then((r) => r.json())
      .then((d: { orders: Order[] }) => {
        setOrders(d.orders);
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
        <h3 className="text-sm font-semibold text-stone-900">Orders</h3>
        <div className="flex gap-1">
          {(['all', 'pending', 'paid', 'cancelled'] as Filter[]).map((f) => (
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
      ) : orders.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-400">No orders</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs uppercase tracking-wide text-stone-400">
                <th className="pb-2">Order</th>
                <th className="pb-2">Customer</th>
                <th className="pb-2">Amount</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {orders.map((o) => (
                <tr key={o.id} className="text-stone-700">
                  <td className="py-2 font-medium text-stone-900">#{o.id}</td>
                  <td className="py-2">
                    <div>{o.customerName ?? o.customerPhone}</div>
                    {o.customerName && <div className="text-xs text-stone-400">{o.customerPhone}</div>}
                  </td>
                  <td className="py-2">{formatRupiah(o.amountIdr)}</td>
                  <td className="py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        o.status === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : o.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : o.status === 'rejected'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="py-2 text-xs text-stone-400">{formatDate(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
