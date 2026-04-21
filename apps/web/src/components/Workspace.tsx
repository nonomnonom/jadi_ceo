import { useEffect, useState } from 'react';
import { listWorkspaceFiles, readWorkspaceFile } from '../lib/api.ts';

type FsEntry = { name: string; path: string; kind: 'file' | 'directory'; size?: number };

export function Workspace() {
  const [entries, setEntries] = useState<FsEntry[] | null>(null);
  const [cwd, setCwd] = useState<string>('');
  const [selected, setSelected] = useState<{ path: string; content: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listWorkspaceFiles(cwd)
      .then((res) => {
        if (cancelled) return;
        setEntries(res.entries);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Gagal membaca folder');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cwd]);

  async function openFile(entry: FsEntry) {
    if (entry.kind === 'directory') {
      setCwd(entry.path);
      setSelected(null);
      return;
    }
    setReading(true);
    setSelected({ path: entry.path, content: '' });
    try {
      const res = await readWorkspaceFile(entry.path);
      setSelected({ path: entry.path, content: res.content });
    } catch (err) {
      setSelected({
        path: entry.path,
        content: `[Error] ${err instanceof Error ? err.message : 'Gagal baca file'}`,
      });
    } finally {
      setReading(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
      <aside className="rounded-2xl border border-stone-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <code className="truncate text-xs text-stone-500">/{cwd}</code>
          {cwd !== '' && (
            <button
              type="button"
              onClick={() => {
                const parent = cwd.includes('/') ? cwd.replace(/\/[^/]+$/, '') : '';
                setCwd(parent);
                setSelected(null);
              }}
              className="rounded-md bg-stone-100 px-2 py-0.5 text-xs text-stone-700 hover:bg-stone-200"
            >
              ↑ Up
            </button>
          )}
        </div>
        {loading ? (
          <div className="py-6 text-center text-sm text-stone-400">Loading…</div>
        ) : error ? (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>
        ) : entries && entries.length > 0 ? (
          <ul className="flex flex-col">
            {entries.map((entry) => (
              <li key={entry.path}>
                <button
                  type="button"
                  onClick={() => openFile(entry)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-stone-100 ${
                    selected?.path === entry.path ? 'bg-stone-100' : ''
                  }`}
                >
                  <span className="text-stone-400">{entry.kind === 'directory' ? '📁' : '📄'}</span>
                  <span className="truncate text-stone-700">{entry.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-6 text-center text-xs text-stone-400">
            Folder kosong. Taruh file ke <code>data/workspaces/default/owner/</code>.
          </div>
        )}
      </aside>
      <section className="min-h-[20rem] rounded-2xl border border-stone-200 bg-white p-4">
        {!selected ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-stone-400">
            <span className="text-4xl">📂</span>
            Pilih file di samping untuk lihat isinya.
          </div>
        ) : (
          <>
            <div className="mb-3 border-b border-stone-100 pb-2">
              <code className="text-xs text-stone-500">{selected.path}</code>
            </div>
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-stone-700">
              {reading ? 'Loading…' : selected.content || '(empty)'}
            </pre>
          </>
        )}
      </section>
    </div>
  );
}
