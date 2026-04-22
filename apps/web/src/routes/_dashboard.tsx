import { Outlet, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { authHeaders, getWhatsAppStatus } from '../lib/api.ts';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Overview', icon: '📊' },
  { to: '/orders', label: 'Orders', icon: '📦', badge: null as number | null },
  { to: '/products', label: 'Products', icon: '📦' },
  { to: '/customers', label: 'Customers', icon: '👥' },
  { to: '/invoices', label: 'Invoices', icon: '📄' },
  { to: '/transactions', label: 'Transactions', icon: '💰' },
  { to: '/reminders', label: 'Reminders', icon: '🔔' },
  { to: '/channels', label: 'Channels', icon: '📱' },
  { to: '/workspace', label: 'Workspace', icon: '📁' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
  { to: '/audit-logs', label: 'Audit Logs', icon: '📋' },
  { to: '/workflows', label: 'Workflows', icon: '🔄' },
];

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<number | null>(null);
  const [waConnected, setWaConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/custom/dashboard/stats', { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { pendingApprovals: number } | null) => {
        if (d) setPendingApprovals(d.pendingApprovals);
      })
      .catch(() => {});
    getWhatsAppStatus()
      .then((s) => setWaConnected(s.connected))
      .catch(() => setWaConnected(false));
  }, []);

  const navItems = NAV_ITEMS.map((item) =>
    item.to === '/orders' ? { ...item, badge: pendingApprovals } : item
  );

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Mobile header */}
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 lg:hidden">
        <h1 className="text-lg font-semibold text-stone-900">Juragan</h1>
        <button
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="rounded-lg p-2 hover:bg-stone-100"
        >
          <svg className="h-5 w-5 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-10 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed bottom-0 left-0 top-0 z-20 w-64 transform overflow-y-auto bg-stone-900 transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4">
          <h2 className="mb-4 text-xl font-semibold text-white">Juragan</h2>
          <div className="mb-4 flex items-center gap-2 text-xs text-stone-400">
            <span
              className={`h-2 w-2 rounded-full ${
                waConnected === null
                  ? 'bg-stone-500 animate-pulse'
                  : waConnected
                  ? 'bg-emerald-500'
                  : 'bg-rose-500'
              }`}
            />
            <span>
              {waConnected === null
                ? 'Checking…'
                : waConnected
                ? 'WhatsApp connected'
                : 'WhatsApp offline'}
            </span>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-stone-400 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Logout button */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-stone-800 p-4">
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('dashboard_secret');
              window.location.href = '/login';
            }}
            className="w-full rounded-lg px-3 py-2 text-sm font-medium text-stone-400 hover:bg-white/5 hover:text-white"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-5xl p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}