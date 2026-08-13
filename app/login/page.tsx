"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion } from "framer-motion";
import { KeyRound, Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Login failed");
        setPending(false);
        return;
      }

      // Only accept same-origin relative paths — never redirect off-site.
      const next = searchParams.get("next");
      const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
      router.replace(target);
      router.refresh();
    } catch {
      setError("Could not reach the server");
      setPending(false);
    }
  }

  return (
    <main className="cyber-grid-bg flex min-h-screen items-center justify-center p-4">
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="w-full max-w-sm rounded-2xl border border-slate-700/80 bg-slate-950/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
      >
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-3 text-cyan-400">
            <KeyRound size={22} />
          </div>
          <h1 className="font-[family-name:var(--font-orbitron)] text-2xl font-black tracking-[0.3em] text-slate-100">
            ZIMZ
          </h1>
          <p className="text-xs text-slate-500">Agent Control — authentication required</p>
        </div>

        <label htmlFor="password" className="mb-2 block text-xs font-medium text-slate-400">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 font-[family-name:var(--font-geist-mono)] text-sm text-slate-100 outline-none transition focus:border-cyan-500/70 focus:ring-1 focus:ring-cyan-500/40"
        />

        {error && (
          <p role="alert" className="mt-3 text-xs text-rose-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || password.length === 0}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/50 bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending && <Loader2 size={15} className="animate-spin" />}
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </motion.form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
