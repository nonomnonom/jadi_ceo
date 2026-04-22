import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secretInput, setSecretInput] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const secret = secretInput.trim();

    if (!secret) {
      setError('Secret is required');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/custom/settings', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
      });

      if (res.ok) {
        localStorage.setItem('dashboard_secret', secret);
        navigate('/dashboard');
      } else {
        setError('Invalid secret');
      }
    } catch {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-stone-900">Juragan</h1>
          <p className="mt-1 text-sm text-stone-500">AI business assistant untuk bisnis Anda</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="secret" className="block text-sm font-medium text-stone-700">
              Dashboard Secret
            </label>
            <input
              id="secret"
              name="secret"
              type="password"
              required
              placeholder="Masukkan secret key"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm placeholder-stone-400 shadow-sm focus:border-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-900"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}