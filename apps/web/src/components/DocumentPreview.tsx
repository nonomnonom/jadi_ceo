import { useEffect, useState } from 'react';

type Document = {
  name: string;
  path: string;
  content: string;
  type: 'markdown' | 'text';
};

export function DocumentPreview() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch document list from API
    fetch('/custom/documents')
      .then((r) => r.json())
      .then((d: { documents: Document[] }) => {
        setDocuments(d.documents);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedDoc) return;
    setLoadingContent(true);
    fetch(`/custom/documents/${encodeURIComponent(selectedDoc.path)}`)
      .then((r) => r.json())
      .then((d: { content: string }) => {
        setSelectedDoc((prev) => (prev ? { ...prev, content: d.content } : null));
        setLoadingContent(false);
      })
      .catch(() => setLoadingContent(false));
  }, [selectedDoc]);

  function renderMarkdown(text: string): string {
    // Simple markdown rendering for preview
    return text
      // Headers
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/```([\s\S]+?)```/g, '<pre class="bg-stone-100 p-3 rounded-lg my-2 overflow-x-auto"><code>$1</code></pre>')
      // Inline code
      .replace(/`(.+?)`/g, '<code class="bg-stone-100 px-1 rounded">$1</code>')
      // Lists
      .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4">$2</li>')
      // Line breaks
      .replace(/\n\n/g, '</p><p class="my-2">')
      .replace(/\n/g, '<br />');
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-stone-900">Documents</h3>

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
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Document list */}
          <div className="max-h-64 overflow-y-auto rounded-lg border border-stone-100">
            {documents.length === 0 ? (
              <p className="p-4 text-center text-sm text-stone-400">No documents</p>
            ) : (
              <ul className="divide-y divide-stone-50">
                {documents.map((doc) => (
                  <li
                    key={doc.path}
                    onClick={() => setSelectedDoc(doc)}
                    className={`cursor-pointer px-3 py-2 transition ${
                      selectedDoc?.path === doc.path ? 'bg-stone-50' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-stone-400 uppercase">{doc.type}</span>
                    </div>
                    <div className="font-medium text-stone-700">{doc.name}</div>
                    <div className="text-xs text-stone-400 truncate">{doc.path}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Document preview */}
          <div className="max-h-64 overflow-y-auto rounded-lg border border-stone-100 bg-stone-50">
            {!selectedDoc ? (
              <p className="p-4 text-center text-sm text-stone-400">
                Select a document to preview
              </p>
            ) : loadingContent ? (
              <div className="p-4">
                <div className="h-4 w-3/4 animate-pulse rounded bg-stone-200" />
                <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-stone-200" />
              </div>
            ) : selectedDoc.type === 'markdown' ? (
              <div
                className="prose prose-sm max-w-none p-4 text-stone-700"
                dangerouslySetInnerHTML={{
                  __html: `<p class="my-2">${renderMarkdown(selectedDoc.content)}</p>`,
                }}
              />
            ) : (
              <pre className="whitespace-pre-wrap p-4 text-sm text-stone-700">
                {selectedDoc.content}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
