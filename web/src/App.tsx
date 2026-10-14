import { useState } from 'react';
import { Layout, type TabKey } from './components/Layout';
import { Login } from './components/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { FiltersProvider } from './context/FiltersContext';

function Shell() {
  const { role, loading } = useAuth();
  const [tab, setTab] = useState<TabKey>('dashboard');

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Caricamento…</div>;
  }
  if (!role) return <Login />;

  return (
    <DataProvider>
      <FiltersProvider>
        <Layout tab={tab} setTab={setTab} />
      </FiltersProvider>
    </DataProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
