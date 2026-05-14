"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";

export function ResetForm({ mode }: { mode: "request" | "update" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { push } = useToast();
  const router = useRouter();

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/reset-password?mode=update`,
    });
    setLoading(false);
    if (error) { push(error.message, "error"); return; }
    setSent(true);
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { push(error.message, "error"); return; }
    push("Šifra promenjena", "success");
    router.push("/");
  }

  if (mode === "update") {
    return (
      <form onSubmit={updatePassword} className="space-y-3 card">
        <div>
          <label className="label">Nova šifra</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </div>
        <button disabled={loading} className="btn-primary w-full">{loading ? "..." : "Sačuvaj"}</button>
      </form>
    );
  }

  if (sent) return <div className="card text-sm">Email poslat. Proveri inbox.</div>;

  return (
    <form onSubmit={requestReset} className="space-y-3 card">
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <button disabled={loading} className="btn-primary w-full">{loading ? "..." : "Pošalji"}</button>
    </form>
  );
}
