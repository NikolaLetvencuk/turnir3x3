"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setPopupAdEnabled } from "./actions";
import { useToast } from "@/components/ui/Toast";

export function PopupAdToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);

  async function onToggle() {
    const next = !enabled;
    setPending(true);
    const res = await setPopupAdEnabled(next);
    setPending(false);
    if (!res.ok) { push(res.error, "error"); return; }
    setEnabled(next);
    push(next ? "Popup reklama uključena" : "Popup reklama isključena", "success");
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-medium">Popup reklama</div>
        <p className="text-xs text-zinc-500">
          Slika: <code className="font-mono">/public/ads/popup.jpg</code>. Kad uključiš, prikazuje se posetiocima na početnoj — svaki vidi jednom dok ne klikne X.
        </p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        className={`shrink-0 inline-flex items-center rounded-full h-7 w-12 px-0.5 transition ${
          enabled ? "bg-blue-600" : "bg-zinc-300"
        } disabled:opacity-60`}
        aria-pressed={enabled}
        aria-label="Uključi/isključi popup reklamu"
      >
        <span
          className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
