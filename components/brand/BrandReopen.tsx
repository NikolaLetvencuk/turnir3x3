"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { clearBrand } from "@/app/brand-actions";

// Demo-only: clears the brand choice so the welcome popup shows again
// (lets you demo a different tournament name without clearing cookies).
export function BrandReopen() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await clearBrand();
          router.refresh();
        })
      }
      disabled={pending}
      className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"
    >
      <RefreshCw className="w-3.5 h-3.5" /> Promeni turnir
    </button>
  );
}
