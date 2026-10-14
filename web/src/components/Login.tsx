import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';

export function Login() {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      await login(password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Accesso non riuscito.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-panel w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 font-black text-2xl shadow-lg shadow-amber-500/20">
            ⚡
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 via-amber-200 to-yellow-400 bg-clip-text text-transparent">
              Fast_Prod
            </h1>
            <p className="text-xs text-gray-400">Gestione produttività officina</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-gray-400 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Inserisci la password"
              className="workshop-input"
            />
          </div>

          {error && (
            <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button type="submit" disabled={busy || !password} className="btn-gold w-full justify-center">
            {busy ? 'Accesso…' : 'Entra'}
          </button>
        </form>

        <p className="text-[11px] text-gray-500 mt-6 leading-relaxed">
          Uso interno, solo rete locale. La password <strong className="text-gray-400">admin</strong> permette di
          inserire e modificare i dati; la password <strong className="text-gray-400">utente</strong> dà accesso in
          sola lettura.
        </p>
      </div>
    </div>
  );
}
