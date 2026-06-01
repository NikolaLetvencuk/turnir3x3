"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { setBrand } from "@/app/brand-actions";
import { DEFAULT_BRAND } from "@/lib/brands";

// First-visit popup (demo mode). Blocks the homepage until the visitor enters
// their tournament name or skips. Unknown / skipped → Petrovski default.
export function BrandGate({ show }: { show: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(show);

  if (!open) return null;

  function choose(value: string) {
    startTransition(async () => {
      // Empty → default code so the cookie is set (gate won't reshow) and the
      // app shows Petrovski.
      await setBrand(value.trim() || DEFAULT_BRAND.code);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-[70] bg-zinc-950/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold-500/15 text-gold-400">
          <Sparkles className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Dobrodošli</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Unesi naziv svog turnira da vidiš sajt personalizovan za tebe.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            choose(name);
          }}
          className="space-y-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Naziv turnira…"
            maxLength={60}
            autoFocus
            className="input text-center"
          />
          <button disabled={pending} className="btn-primary w-full !py-3">
            {pending ? "…" : "Prikaži moj turnir"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => choose("")}
          disabled={pending}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Preskoči (pogledaj demo)
        </button>
      </div>
    </div>
  );
}
