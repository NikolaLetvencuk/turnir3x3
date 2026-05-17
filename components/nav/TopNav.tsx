import Link from "next/link";
import { Trophy } from "lucide-react";
import { BackButton } from "./BackButton";

type Profile = { email: string; role: string } | null;

export function TopNav({ profile }: { profile: Profile }) {
  const isAdmin = profile?.role === "admin";
  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <BackButton />
          <Link href="/" className="flex items-center gap-2 font-semibold shrink-0">
            <Trophy className="w-5 h-5 text-emerald-600" />
            <span className="truncate">Turnir Kula</span>
          </Link>
        </div>
        <nav className="hidden sm:flex items-center gap-4 text-sm">
          <Link href="/standings" className="hover:text-emerald-700">Tabele</Link>
          <Link href="/matches" className="hover:text-emerald-700">Mečevi</Link>
          <Link href="/players" className="hover:text-emerald-700">Igrači</Link>
          <Link href="/bracket" className="hover:text-emerald-700">Eliminacije</Link>
          <Link href="/fantasy" className="hover:text-emerald-700">Fantasy</Link>
          {isAdmin && (
            <Link href="/admin" className="text-emerald-700 font-medium">Admin</Link>
          )}
        </nav>
        <div className="flex items-center gap-2 text-sm min-w-0">
          {isAdmin && (
            <Link
              href="/admin"
              className="sm:hidden inline-flex items-center gap-1 bg-emerald-600 text-white rounded-md px-2.5 py-1.5 text-xs font-medium shrink-0"
            >
              Admin
            </Link>
          )}
          {profile ? (
            <Link href="/profile" className="hidden sm:inline text-zinc-600 hover:text-zinc-900 truncate max-w-[180px]">
              {profile.email}
            </Link>
          ) : (
            <Link href="/auth/login" className="btn-secondary !py-1.5 !px-3 shrink-0">Prijava</Link>
          )}
        </div>
      </div>
    </header>
  );
}
