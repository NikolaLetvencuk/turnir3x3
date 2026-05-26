import Link from "next/link";
import Image from "next/image";
import { BackButton } from "./BackButton";

type Profile = { email: string; role: string } | null;

export function TopNav({ profile }: { profile: Profile }) {
  const isAdmin = profile?.role === "admin";
  return (
    <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <BackButton />
          <Link href="/" className="flex items-center gap-2 font-semibold shrink-0">
            <Image
              src="/logo/logomkpetrovskibela_pozadina.png"
              alt='Memorijalni Turnir "Vladislav Petrovski" Kula'
              width={32}
              height={32}
              className="rounded"
              priority
            />
            <span className="truncate">Petrovski Kula</span>
          </Link>
        </div>
        <nav className="hidden sm:flex items-center gap-4 text-sm">
          <Link href="/standings" className="hover:text-blue-700">Tabele</Link>
          <Link href="/matches" className="hover:text-blue-700">Mečevi</Link>
          <Link href="/players" className="hover:text-blue-700">Igrači</Link>
          <Link href="/bracket" className="hover:text-blue-700">Eliminacije</Link>
          <Link href="/fantasy" className="hover:text-blue-700">Fantasy</Link>
          <Link href="/vesti" className="hover:text-blue-700">Vesti</Link>
          {isAdmin && (
            <Link href="/admin" className="text-blue-700 font-medium">Admin</Link>
          )}
        </nav>
        <div className="flex items-center gap-2 text-sm min-w-0">
          {isAdmin && (
            <Link
              href="/admin"
              className="sm:hidden inline-flex items-center gap-1 bg-blue-600 text-white rounded-md px-2.5 py-1.5 text-xs font-medium shrink-0"
            >
              Admin
            </Link>
          )}
          {profile ? (
            <Link href="/profile" className="hidden sm:inline text-zinc-400 hover:text-zinc-100 truncate max-w-[180px]">
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
