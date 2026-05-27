"use client";

import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Inline back button rendered at the top of every non-home page. Lives in the
 * page content (not in the sticky navbar) so clicking it doesn't cause the
 * navbar to flicker / reflow during navigation.
 */
export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === "/") return null;

  function onClick() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Nazad"
      className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-blue-300 mb-3 -ml-1 px-2 py-1 rounded-md hover:bg-zinc-800"
    >
      <ChevronLeft className="w-4 h-4" />
      <span>Nazad</span>
    </button>
  );
}
