import { useEffect, useState } from 'react';

type Workflow = {
  id: string;
  name: string;
  trigger: string;
  steps: number;
};

export function WorkflowsTable() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/custom/workflows')
      .then((r) => r.json())
      .then((d: { workflows: Workflow[] }) => {
        setWorkflows(d.workflows);
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
        <h3 className="text-sm font-semibold text-stone-900">Workflows</h3>
        <span className="text-xs text-stone-400">{workflows.length} workflows</span>
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
      ) : workflows.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-400">No workflows</p>
      ) : (
        <div className="space-y-2">
          {workflows.map((w) => (
            <div key={w.id} className="flex items-center justify-between border-b border-stone-50 py-3 last:border-0">
              <div>
                <p className="text-sm font-medium text-stone-900">{w.name}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-stone-400">
                  <span className="rounded-full bg-stone-100 px-2 py-0.5">{w.trigger}</span>
                  <span>{w.steps} steps</span>
                </div>
              </div>
              <span className="text-xs text-stone-400">/{w.id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
