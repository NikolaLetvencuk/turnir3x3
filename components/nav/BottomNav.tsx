"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Trophy, ListChecks, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Početna", icon: Home },
  { href: "/standings", label: "Tabele", icon: Trophy },
  { href: "/matches", label: "Mečevi", icon: ListChecks },
  { href: "/fantasy", label: "Fantasy", icon: Sparkles },
  { href: "/profile", label: "Profil", icon: User },
];

export function BottomNav({ isAuthed, isAdmin }: { isAuthed: boolean; isAdmin: boolean }) {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 z-30 sm:hidden">
      <ul className="grid grid-cols-5 max-w-5xl mx-auto">
        {items.map((it) => {
          const active = path === it.href || (it.href !== "/" && path.startsWith(it.href));
          const Icon = it.icon;
          const href = it.href === "/profile" && !isAuthed ? "/auth/login" : it.href;
          return (
            <li key={it.href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center py-2 text-xs",
                  active ? "text-emerald-700" : "text-zinc-500",
                )}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
      {isAdmin && (
        <div className="text-center py-1 bg-emerald-50 text-xs">
          <Link href="/admin" className="text-emerald-700 font-medium">Admin panel →</Link>
        </div>
      )}
    </nav>
  );
}
