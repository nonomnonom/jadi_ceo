import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Overview } from './components/Overview.tsx';
import { Settings } from './components/Settings.tsx';
import { Workspace } from './components/Workspace.tsx';
import { ChannelStatus } from './components/ChannelStatus.tsx';
import { AgentToggle } from './components/AgentToggle.tsx';
import { OrdersTable } from './components/OrdersTable.tsx';
import { ProductsTable } from './components/ProductsTable.tsx';
import { CustomersTable } from './components/CustomersTable.tsx';
import { InvoicesTable } from './components/InvoicesTable.tsx';
import { TransactionsTable } from './components/TransactionsTable.tsx';
import { RemindersTable } from './components/RemindersTable.tsx';
import { ConversationsViewer } from './components/ConversationsViewer.tsx';
import { Login } from './routes/login.tsx';
import { DashboardLayout } from './routes/_dashboard.tsx';

type Tab = 'overview' | 'workspace' | 'settings' | 'channels' | 'orders';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'channels', label: 'Channels' },
  { id: 'orders', label: 'Orders' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'settings', label: 'Settings' },
];

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Overview />} />
          <Route path="channels" element={
            <div className="flex flex-col gap-4">
              <ChannelStatus />
              <AgentToggle />
              <ConversationsViewer />
            </div>
          } />
          <Route path="orders" element={<OrdersTable />} />
          <Route path="products" element={<ProductsTable />} />
          <Route path="customers" element={<CustomersTable />} />
          <Route path="invoices" element={<InvoicesTable />} />
          <Route path="transactions" element={<TransactionsTable />} />
          <Route path="reminders" element={<RemindersTable />} />
          <Route path="workspace" element={<Workspace />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export { TABS };