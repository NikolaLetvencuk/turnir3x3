"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const IMAGE_PATH = "/ads/popup.jpg";

export function PopupAd({ enabled, version }: { enabled: boolean; version: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    // Per-version dismissal: when admin toggles or updates the ad,
    // updated_at changes and previously-dismissed users see it again.
    const key = `popup-ad-dismissed-${version}`;
    if (window.localStorage.getItem(key) === "1") return;
    const t = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(t);
  }, [enabled, version]);

  function close() {
    setOpen(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`popup-ad-dismissed-${version}`, "1");
    }
  }

  if (!enabled || !open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="relative max-w-md w-full bg-white rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Zatvori"
          className="absolute top-2 right-2 z-10 rounded-full bg-white/90 hover:bg-white text-zinc-700 p-1.5 shadow"
        >
          <X className="w-4 h-4" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={IMAGE_PATH}
          alt="Reklama"
          className="block w-full h-auto"
        />
      </div>
    </div>
  );
}
