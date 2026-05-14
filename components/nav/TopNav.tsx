import Link from "next/link";
import { Trophy } from "lucide-react";

type Profile = { email: string; role: string } | null;

export function TopNav({ profile }: { profile: Profile }) {
  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Trophy className="w-5 h-5 text-emerald-600" />
          <span>Turnir Kula</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-4 text-sm">
          <Link href="/standings" className="hover:text-emerald-700">Tabele</Link>
          <Link href="/matches" className="hover:text-emerald-700">Mečevi</Link>
          <Link href="/players" className="hover:text-emerald-700">Igrači</Link>
          <Link href="/bracket" className="hover:text-emerald-700">Eliminacije</Link>
          <Link href="/fantasy" className="hover:text-emerald-700">Fantasy</Link>
          {profile?.role === "admin" && (
            <Link href="/admin" className="text-emerald-700 font-medium">Admin</Link>
          )}
        </nav>
        <div className="flex items-center gap-2 text-sm">
          {profile ? (
            <Link href="/profile" className="text-zinc-600 hover:text-zinc-900 truncate max-w-[140px]">
              {profile.email}
            </Link>
          ) : (
            <Link href="/auth/login" className="btn-secondary !py-1.5 !px-3">Prijava</Link>
          )}
        </div>
      </div>
    </header>
  );
}
