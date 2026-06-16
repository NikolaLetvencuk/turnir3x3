"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

/**
 * Inline back button rendered at the top of every non-home page.
 *
 * Default behavior: go back in real browser history, so it returns to the page
 * you actually came from (e.g. Home → club details → Back → Home), not a fixed
 * parent. Falls back to a deterministic parent route when there's no in-app
 * history yet (direct/shared link) or for query-param-heavy screens where real
 * back loops on itself (fantasy team/league editors, the live-entry screen).
 */
function parentPathOf(clean: string): string {
  const rules: Array<[RegExp, string]> = [
    [/^\/admin\/matches\/[^/]+\/live$/, "/admin/matches"],
    [/^\/fantasy\/leagues\/[^/]+$/, "/fantasy"],
    [/^\/fantasy\/leagues$/, "/fantasy"],
    [/^\/fantasy\/team(\/.*)?$/, "/fantasy"],
    [/^\/admin\/[^/]+$/, "/admin"],
    [/^\/players\/[^/]+$/, "/players"],
    [/^\/teams\/[^/]+$/, "/standings"],
    [/^\/matches\/[^/]+$/, "/matches"],
  ];
  for (const [re, target] of rules) if (re.test(clean)) return target;
  const segments = clean.split("/").filter(Boolean);
  if (segments.length <= 1) return "/";
  segments.pop();
  return "/" + segments.join("/");
}

// Screens where real history-back is undesirable (query-param navigation loops).
const PREFER_PARENT = [
  /^\/fantasy\/team(\/.*)?$/,
  /^\/fantasy\/leagues(\/.*)?$/,
  /^\/admin\/matches\/[^/]+\/live$/,
];

const NAV_KEY = "navCount";

export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();

  // Count in-app navigations this tab session, so we know whether a real
  // history-back will stay inside the app. Deduped per pathname so React Strict
  // Mode's double-invoked effect (dev) doesn't over-count.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("navLast") !== pathname) {
        const n = Number(sessionStorage.getItem(NAV_KEY) || "0");
        sessionStorage.setItem(NAV_KEY, String(n + 1));
        sessionStorage.setItem("navLast", pathname);
      }
    } catch {}
  }, [pathname]);

  if (pathname === "/") return null;
  const clean = pathname.replace(/\/+$/, "");

  function onBack() {
    const preferParent = PREFER_PARENT.some((re) => re.test(clean));
    let hasHistory = false;
    try {
      hasHistory = Number(sessionStorage.getItem(NAV_KEY) || "0") > 1 && window.history.length > 1;
    } catch {}
    if (!preferParent && hasHistory) router.back();
    else router.push(parentPathOf(clean));
  }

  return (
    <button
      type="button"
      onClick={onBack}
      aria-label="Nazad"
      className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-blue-300 mb-3 -ml-1 px-2 py-1 rounded-md hover:bg-zinc-800"
    >
      <ChevronLeft className="w-4 h-4" />
      <span>Nazad</span>
    </button>
  );
}
