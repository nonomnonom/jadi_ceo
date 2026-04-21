import { type FormEvent, useEffect, useState } from 'react';
import { type SettingsStatus, getSettings, saveSettings } from '../lib/api.ts';

export function Settings() {
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [telegramToken, setTelegramToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ saved: string[]; restartRequired: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings()
      .then(setStatus)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Gagal memuat settings'),
      );
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const body: { openrouterApiKey?: string; telegramBotToken?: string } = {};
      if (openrouterKey.length > 0) body.openrouterApiKey = openrouterKey;
      if (telegramToken.length > 0) body.telegramBotToken = telegramToken;
      if (Object.keys(body).length === 0) {
        setError('Isi minimal satu field');
        return;
      }
      const res = await saveSettings(body);
      setResult(res);
      setOpenrouterKey('');
      setTelegramToken('');
      const fresh = await getSettings();
      setStatus(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-stone-900">Status onboarding</h3>
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <StatusRow
            label="OpenRouter API key"
            configured={status ? Boolean(status.configured || status.envHasOpenRouter) : null}
            masked={status?.openrouterApiKey ?? null}
            hint={status?.envHasOpenRouter ? 'dari environment variable' : undefined}
          />
          <StatusRow
            label="Telegram bot token"
            configured={status ? Boolean(status.telegramBotToken) : null}
            masked={status?.telegramBotToken ?? null}
            hint="belum digunakan — channel Telegram wiring di M4"
          />
        </div>
      </section>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-5"
      >
        <div>
          <h3 className="text-sm font-semibold text-stone-900">Update kredensial</h3>
          <p className="mt-1 text-xs text-stone-500">
            Disimpan di tenant default. Server API perlu di-restart supaya nilai baru dipakai (untuk
            sekarang).
          </p>
        </div>

        <Field
          label="OpenRouter API key"
          hint="Dapat dari https://openrouter.ai/keys. Formatnya: sk-or-v1-..."
          value={openrouterKey}
          onChange={setOpenrouterKey}
          placeholder="sk-or-v1-..."
          type="password"
        />

        <Field
          label="Telegram bot token"
          hint="Buat bot baru di @BotFather, copy tokennya (contoh: 7000000000:AAH...)"
          value={telegramToken}
          onChange={setTelegramToken}
          placeholder="7000000000:AAH..."
          type="password"
        />

        {error ? (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        ) : null}
        {result && result.saved.length > 0 ? (
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Tersimpan: {result.saved.join(', ')}.{' '}
            {result.restartRequired && 'Restart API server untuk apply.'}
          </div>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={saving || (openrouterKey.length === 0 && telegramToken.length === 0)}
            className="rounded-xl bg-stone-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </form>
    </div>
  );
}

function StatusRow({
  label,
  configured,
  masked,
  hint,
}: {
  label: string;
  configured: boolean | null;
  masked: string | null;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-stone-700">{label}</div>
        {hint ? <div className="text-xs text-stone-400">{hint}</div> : null}
      </div>
      <div className="flex items-center gap-2 text-xs">
        {configured === null ? (
          <span className="text-stone-400">…</span>
        ) : configured ? (
          <>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
              OK
            </span>
            {masked ? <code className="text-stone-500">{masked}</code> : null}
          </>
        ) : (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
            Belum diisi
          </span>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
  type,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'password';
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      {hint ? <span className="text-xs text-stone-500">{hint}</span> : null}
      <input
        type={type ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm outline-none focus:border-stone-500 focus:bg-white"
        autoComplete="off"
      />
    </label>
  );
}
