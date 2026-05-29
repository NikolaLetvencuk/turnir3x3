"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Inline back button rendered at the top of every non-home page. Navigates to
 * a deterministic *parent* route derived from the current path rather than
 * using browser history — browser-back could land on the same page after a
 * query-param navigation (e.g. fantasy day switches), which felt broken.
 */
function parentPathOf(pathname: string): string {
  const clean = pathname.replace(/\/+$/, "");

  // Pattern rules for dynamic / nested routes (checked before the generic
  // "drop last segment" fallback). Order matters — most specific first.
  const rules: Array<[RegExp, string]> = [
    [/^\/admin\/matches\/[^/]+\/live$/, "/admin/matches"], // finish match → match list
    [/^\/fantasy\/leagues\/[^/]+$/, "/fantasy"], // a league → fantasy home
    [/^\/fantasy\/leagues$/, "/fantasy"],
    [/^\/fantasy\/team(\/.*)?$/, "/fantasy"], // team editor / history → fantasy home
    [/^\/admin\/[^/]+$/, "/admin"], // any admin sub-tab → admin home
    [/^\/players\/[^/]+$/, "/players"],
    [/^\/teams\/[^/]+$/, "/standings"],
    [/^\/matches\/[^/]+$/, "/matches"],
  ];
  for (const [re, target] of rules) {
    if (re.test(clean)) return target;
  }

  // Generic fallback: drop the last path segment.
  const segments = clean.split("/").filter(Boolean);
  if (segments.length <= 1) return "/";
  segments.pop();
  return "/" + segments.join("/");
}

export function BackButton() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  const target = parentPathOf(pathname);

  return (
    <Link
      href={target}
      aria-label="Nazad"
      className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-blue-300 mb-3 -ml-1 px-2 py-1 rounded-md hover:bg-zinc-800"
    >
      <ChevronLeft className="w-4 h-4" />
      <span>Nazad</span>
    </Link>
  );
}
