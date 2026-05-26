import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  const next = searchParams.next ?? "/";
  const user = await getCurrentUser();
  if (user) redirect(next);
  return (
    <div className="max-w-sm mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Prijava</h1>
      {searchParams.error && (
        <div className="card border border-red-500/40 bg-red-500/10 text-sm text-red-200">
          <div className="font-medium mb-0.5">Greška pri prijavi</div>
          <div className="text-xs text-red-200/80 break-words">{searchParams.error}</div>
        </div>
      )}
      <LoginForm next={next} />
      <div className="text-sm text-zinc-400 space-y-1">
        <p>Nemaš nalog? <Link href="/auth/register" className="text-blue-300">Registruj se</Link></p>
        <p>Zaboravljena šifra? <Link href="/auth/reset-password" className="text-blue-300">Resetuj</Link></p>
      </div>
    </div>
  );
}
