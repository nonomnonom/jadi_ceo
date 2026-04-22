import { useEffect, useState } from 'react';

type Product = {
  id: number;
  name: string;
  sku: string | null;
  priceIdr: number;
  priceFormatted: string;
  stockQty: number;
  lowStockAt: number;
  isLowStock: boolean;
  createdAt: number;
  updatedAt: number;
};

export function ProductsTable() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/custom/products')
      .then((r) => r.json())
      .then((d: { products: Product[] }) => {
        setProducts(d.products);
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
        <h3 className="text-sm font-semibold text-stone-900">Products</h3>
        <span className="text-xs text-stone-400">{products.length} items</span>
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
      ) : products.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-400">No products</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs uppercase tracking-wide text-stone-400">
                <th className="pb-2">Product</th>
                <th className="pb-2">SKU</th>
                <th className="pb-2">Price</th>
                <th className="pb-2">Stock</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {products.map((p) => (
                <tr key={p.id} className="text-stone-700">
                  <td className="py-2 font-medium text-stone-900">{p.name}</td>
                  <td className="py-2 text-stone-400">{p.sku ?? '—'}</td>
                  <td className="py-2">{p.priceFormatted}</td>
                  <td className="py-2">
                    <span className={p.stockQty === 0 ? 'text-rose-500' : ''}>
                      {p.stockQty}
                    </span>
                  </td>
                  <td className="py-2">
                    {p.stockQty === 0 ? (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                        Out of stock
                      </span>
                    ) : p.isLowStock ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Low stock
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        In stock
                      </span>
                    )}
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
