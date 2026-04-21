import { useEffect, useState } from 'react';

type BrandAsset = {
  name: string;
  path: string;
  type: 'css' | 'html' | 'json';
  preview: string | null;
};

function renderCSSPreview(css: string): string {
  // Extract CSS variables and show them as styled swatches
  const varRegex = /--([a-zA-Z-]+):\s*([^;]+);/g;
  const variables: { name: string; value: string }[] = [];
  let match;

  while ((match = varRegex.exec(css)) !== null) {
    variables.push({ name: match[1]!, value: match[2]!.trim() });
  }

  return variables
    .map(
      (v) => `
    <div class="flex items-center gap-3 py-1">
      <div class="w-8 h-8 rounded border border-stone-200" style="background: ${v.value}"></div>
      <div>
        <div class="text-xs font-mono text-stone-500">${v.name}</div>
        <div class="text-sm text-stone-700">${v.value}</div>
      </div>
    </div>
  `
    )
    .join('');
}

export function BrandGuidePreview() {
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<BrandAsset | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tokens' | 'html' | 'preview'>('tokens');

  useEffect(() => {
    fetch('/custom/brand-assets')
      .then((r) => r.json())
      .then((d: { assets: BrandAsset[] }) => {
        setAssets(d.assets);
        if (d.assets.length > 0) {
          setSelectedAsset(d.assets[0] ?? null);
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedAsset) return;
    setLoadingPreview(true);

    const endpoint =
      selectedAsset.type === 'html'
        ? `/custom/brand-assets/${encodeURIComponent(selectedAsset.path)}/render`
        : `/custom/brand-assets/${encodeURIComponent(selectedAsset.path)}`;

    fetch(endpoint)
      .then((r) => r.json())
      .then((d: { content?: string; preview?: string }) => {
        if (selectedAsset.type === 'css') {
          setPreview(renderCSSPreview(d.content || ''));
        } else {
          setPreview(d.preview || d.content || '');
        }
        setLoadingPreview(false);
      })
      .catch(() => setLoadingPreview(false));
  }, [selectedAsset]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="h-6 w-32 animate-pulse rounded bg-stone-200" />
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-stone-100" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-stone-900">Brand Guide</h3>
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-900">Brand Guide</h3>
        <div className="flex gap-1">
          {(['tokens', 'preview'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                activeTab === tab ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100'
              }`}
            >
              {tab === 'tokens' ? 'Tokens' : 'Preview'}
            </button>
          ))}
        </div>
      </div>

      {assets.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-400">No brand assets generated yet</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {/* Asset list */}
          <div className="max-h-64 overflow-y-auto rounded-lg border border-stone-100">
            <ul className="divide-y divide-stone-50">
              {assets.map((asset) => (
                <li
                  key={asset.path}
                  onClick={() => setSelectedAsset(asset)}
                  className={`cursor-pointer px-3 py-2 transition ${
                    selectedAsset?.path === asset.path ? 'bg-stone-50' : 'hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium uppercase ${
                        asset.type === 'css'
                          ? 'text-blue-600'
                          : asset.type === 'html'
                          ? 'text-emerald-600'
                          : 'text-stone-500'
                      }`}
                    >
                      {asset.type}
                    </span>
                  </div>
                  <div className="mt-0.5 font-medium text-stone-700">{asset.name}</div>
                </li>
              ))}
            </ul>
          </div>

          {/* Preview area */}
          <div className="col-span-2 max-h-64 overflow-y-auto rounded-lg border border-stone-100 bg-stone-50">
            {!selectedAsset ? (
              <p className="p-4 text-center text-sm text-stone-400">
                Select an asset to preview
              </p>
            ) : loadingPreview ? (
              <div className="p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-stone-200" />
                <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-stone-200" />
              </div>
            ) : activeTab === 'tokens' ? (
              <div className="p-4">
                <div className="mb-2 text-xs font-medium uppercase text-stone-400">
                  CSS Variables
                </div>
                <div
                  className="space-y-1"
                  dangerouslySetInnerHTML={{ __html: preview || '<p class="text-stone-400">No variables found</p>' }}
                />
              </div>
            ) : selectedAsset.type === 'html' ? (
              <div
                className="p-4"
                dangerouslySetInnerHTML={{ __html: preview || '' }}
              />
            ) : selectedAsset.type === 'css' ? (
              <pre className="whitespace-pre-wrap p-4 text-xs text-stone-600">{preview}</pre>
            ) : (
              <pre className="whitespace-pre-wrap p-4 text-xs text-stone-600">{preview}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
