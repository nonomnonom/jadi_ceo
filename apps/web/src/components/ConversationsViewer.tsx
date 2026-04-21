import { useEffect, useState } from 'react';

type Conversation = {
  id: number;
  channel: string;
  customerPhone: string;
  customerName: string | null;
  lastMessageAt: number | null;
  createdAt: number;
};

type Message = {
  id: number;
  channel: string;
  direction: 'incoming' | 'outgoing';
  content: string;
  createdAt: number;
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ConversationsViewer() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/custom/conversations')
      .then((r) => r.json())
      .then((d: { conversations: Conversation[] }) => {
        setConversations(d.conversations);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedPhone) return;
    setLoadingMessages(true);
    fetch(`/custom/conversations/${selectedPhone}?limit=50`)
      .then((r) => r.json())
      .then((d: { messages: Message[] }) => {
        setMessages(d.messages);
        setLoadingMessages(false);
      })
      .catch(() => setLoadingMessages(false));
  }, [selectedPhone]);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-stone-900">Conversations</h3>

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
          {/* Conversation list */}
          <div className="max-h-64 overflow-y-auto rounded-lg border border-stone-100">
            {conversations.length === 0 ? (
              <p className="p-4 text-center text-sm text-stone-400">No conversations</p>
            ) : (
              <ul className="divide-y divide-stone-50">
                {conversations.map((c) => (
                  <li
                    key={c.id}
                    onClick={() => setSelectedPhone(c.customerPhone)}
                    className={`cursor-pointer px-3 py-2 transition ${
                      selectedPhone === c.customerPhone ? 'bg-stone-50' : 'hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-stone-700">
                        {c.customerName ?? c.customerPhone}
                      </span>
                      <span className="text-xs text-stone-400">{c.channel}</span>
                    </div>
                    {c.customerName && (
                      <div className="text-xs text-stone-400">{c.customerPhone}</div>
                    )}
                    {c.lastMessageAt && (
                      <div className="mt-1 text-xs text-stone-400">
                        {formatDate(c.lastMessageAt)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Message view */}
          <div className="max-h-64 overflow-y-auto rounded-lg border border-stone-100">
            {!selectedPhone ? (
              <p className="p-4 text-center text-sm text-stone-400">
                Select a conversation to view messages
              </p>
            ) : loadingMessages ? (
              <div className="space-y-2 p-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-stone-100" />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <p className="p-4 text-center text-sm text-stone-400">No messages</p>
            ) : (
              <ul className="divide-y divide-stone-50 p-2">
                {messages.map((m) => (
                  <li key={m.id} className="py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-medium ${
                          m.direction === 'incoming' ? 'text-emerald-600' : 'text-stone-500'
                        }`}
                      >
                        {m.direction === 'incoming' ? 'Customer' : 'Agent'}
                      </span>
                      <span className="text-xs text-stone-400">{formatDate(m.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-stone-700">{m.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
