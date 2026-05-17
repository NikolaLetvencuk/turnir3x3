"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLeague, joinLeague } from "./actions";
import { useToast } from "@/components/ui/Toast";

export function LeagueForms() {
  const { push } = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(); fd.set("name", name);
    const res = await createLeague(fd);
    setPending(false);
    if (!res.ok) { push(res.error, "error"); return; }
    push(`Liga kreirana — kod ${res.data?.invite_code}`, "success");
    setName("");
    if (res.data?.id) {
      router.push(`/fantasy/leagues/${res.data.id}`);
      router.refresh();
    } else {
      router.refresh();
    }
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(); fd.set("code", code);
    const res = await joinLeague(fd);
    setPending(false);
    if (!res.ok) { push(res.error, "error"); return; }
    push("Pridružen ligi", "success");
    setCode("");
    if (res.data?.id) {
      router.push(`/fantasy/leagues/${res.data.id}`);
      router.refresh();
    } else {
      router.refresh();
    }
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <form onSubmit={onCreate} className="card space-y-2">
        <div className="font-medium text-sm">Kreiraj novu ligu</div>
        <input className="input" placeholder="Naziv lige" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={60} />
        <button disabled={pending} className="btn-primary w-full">{pending ? "..." : "Kreiraj"}</button>
        <p className="text-[11px] text-zinc-500">Dobićeš 6-znakovni kod koji deliš sa drugarima.</p>
      </form>
      <form onSubmit={onJoin} className="card space-y-2">
        <div className="font-medium text-sm">Pridruži se preko koda</div>
        <input className="input uppercase tracking-widest font-mono" placeholder="ABCD12" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required maxLength={6} />
        <button disabled={pending} className="btn-secondary w-full">{pending ? "..." : "Pridruži se"}</button>
      </form>
    </div>
  );
}
