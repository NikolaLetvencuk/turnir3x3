"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { setBrand, clearBrand } from "@/app/brand-actions";

// Shown only in demo mode. Lets a visitor type their tournament name to see
// the app personalized with it. Persisted in a cookie so it sticks across
// navigation; "Vrati" clears it back to the default brand.
export function BrandPicker({ currentName, isDefault }: { currentName: string; isDefault: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function apply(value: string) {
    startTransition(async () => {
      await setBrand(value);
      router.refresh();
    });
  }
  function reset() {
    startTransition(async () => {
      await clearBrand();
      setName("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-gold-500/30 bg-gold-500/[0.06] p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-gold-400 shrink-0" />
        <div className="text-sm font-semibold">Pogledaj sajt sa imenom svog turnira</div>
      </div>
      {!isDefault && (
        <div className="text-xs text-zinc-400 mb-2">
          Trenutno prikazano za: <b className="text-gold-300">{currentName}</b>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) apply(name.trim());
        }}
        className="flex gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Unesi naziv turnira…"
          maxLength={60}
          className="input flex-1"
        />
        <button disabled={pending || !name.trim()} className="btn-primary shrink-0">
          {pending ? "…" : "Prikaži"}
        </button>
        {!isDefault && (
          <button
            type="button"
            onClick={reset}
            disabled={pending}
            className="btn-secondary shrink-0 inline-flex items-center gap-1"
            title="Vrati na podrazumevani"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </form>
    </div>
  );
}
