"use client";

import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  // Don't show on root — there's nowhere to go back to.
  if (pathname === "/") return null;

  function onClick() {
    // Browser back. If history is empty (deep link), fall back to home.
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
      className="-ml-1 inline-flex items-center gap-1 px-2 h-9 rounded-md text-zinc-300 hover:bg-zinc-800 active:bg-zinc-700"
    >
      <ChevronLeft className="w-5 h-5" />
      <span className="hidden sm:inline text-sm">Nazad</span>
    </button>
  );
}
