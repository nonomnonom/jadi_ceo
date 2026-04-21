import { type FormEvent, useCallback, useEffect, useState } from 'react';
import {
  type SettingsStatus,
  type TelegramStatus,
  type TelegramTestResult,
  getSettings,
  getTelegramStatus,
  saveSettings,
  testTelegramToken,
} from '../lib/api.ts';

export function Settings() {
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [tgStatus, setTgStatus] = useState<TelegramStatus | null>(null);
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [telegramToken, setTelegramToken] = useState('');
  const [tgTestResult, setTgTestResult] = useState<TelegramTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ saved: string[]; restartRequired: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const refreshStatus = useCallback(() => {
    getSettings()
      .then(setStatus)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Gagal memuat settings'),
      );
    getTelegramStatus()
      .then(setTgStatus)
      .catch(() => setTgStatus(null));
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

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
      setTgTestResult(null);
      refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  async function onTestTelegram() {
    if (telegramToken.trim().length === 0) return;
    setTesting(true);
    setTgTestResult(null);
    try {
      const res = await testTelegramToken(telegramToken.trim());
      setTgTestResult(res);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <TelegramStatusCard status={tgStatus} />

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-stone-900">Status kredensial</h3>
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
            hint={
              tgStatus && 'bot' in tgStatus ? `bot aktif: @${tgStatus.bot.username}` : undefined
            }
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
            Disimpan di tenant default. Server API perlu di-restart supaya nilai baru dipakai.
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

        <div className="flex flex-col gap-2">
          <Field
            label="Telegram bot token"
            hint="Buat bot baru di @BotFather (ketik /newbot), copy tokennya (contoh: 7000000000:AAH...). Test dulu sebelum simpan."
            value={telegramToken}
            onChange={(v) => {
              setTelegramToken(v);
              setTgTestResult(null);
            }}
            placeholder="7000000000:AAH..."
            type="password"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onTestTelegram}
              disabled={testing || telegramToken.trim().length === 0}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {testing ? 'Testing…' : 'Test connection'}
            </button>
            {tgTestResult?.ok === true ? (
              <span className="text-xs text-emerald-700">
                ✓ Bot <strong>@{tgTestResult.bot.username}</strong> ({tgTestResult.bot.firstName})
                siap.
              </span>
            ) : null}
            {tgTestResult?.ok === false ? (
              <span className="text-xs text-rose-700">✗ {tgTestResult.error}</span>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        ) : null}
        {result && result.saved.length > 0 ? (
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Tersimpan: {result.saved.join(', ')}.
            {result.restartRequired ? ' Restart API server untuk apply ke agent.' : ''}
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

      <BotFatherGuide />
    </div>
  );
}

function TelegramStatusCard({ status }: { status: TelegramStatus | null }) {
  if (!status) {
    return (
      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-stone-300" />
          <span className="text-sm text-stone-500">Memuat status Telegram…</span>
        </div>
      </section>
    );
  }
  if (!status.configured) {
    return (
      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-1 h-2.5 w-2.5 rounded-full bg-amber-500" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-900">Telegram belum terhubung</h3>
            <p className="mt-1 text-xs text-amber-800">
              Bikin bot di @BotFather → paste token di bawah → test connection → Simpan → restart
              API server. Panduan di bawah.
            </p>
          </div>
        </div>
      </section>
    );
  }
  if (!status.botReachable) {
    return (
      <section className="rounded-2xl border border-rose-300 bg-rose-50 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-rose-900">
              Token tersimpan tapi bot tidak bisa dihubungi
            </h3>
            <p className="mt-1 text-xs text-rose-800">Error: {status.error}</p>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <div>
            <h3 className="text-sm font-semibold text-emerald-900">
              Bot terhubung: @{status.bot.username}
            </h3>
            <p className="mt-1 text-xs text-emerald-800">
              {status.bot.firstName} · id {status.bot.id}
            </p>
          </div>
        </div>
        <a
          href={status.deepLink}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
        >
          Buka di Telegram ↗
        </a>
      </div>
    </section>
  );
}

function BotFatherGuide() {
  return (
    <section className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
      <h3 className="text-sm font-semibold text-stone-900">Cara bikin bot Telegram</h3>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-stone-700">
        <li>
          Buka Telegram, cari <code>@BotFather</code> dan mulai chat.
        </li>
        <li>
          Kirim <code>/newbot</code>.
        </li>
        <li>Kasih nama bot (bebas, misal: "Juragan Asisten").</li>
        <li>
          Kasih username bot — harus diakhiri <code>bot</code> (misal:{' '}
          <code>juragan_owner_bot</code>). Harus unik di Telegram.
        </li>
        <li>BotFather akan kirim token. Copy paste ke field di atas, test, lalu simpan.</li>
        <li>Restart API server, lalu buka bot kamu di Telegram dan ketik apa aja.</li>
      </ol>
    </section>
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
