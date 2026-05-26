import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  const next = searchParams.next ?? "/";
  const user = await getCurrentUser();
  if (user) redirect(next);
  return (
    <div className="max-w-sm mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Prijava</h1>
      <LoginForm next={next} />
      <div className="text-sm text-zinc-400 space-y-1">
        <p>Nemaš nalog? <Link href="/auth/register" className="text-blue-300">Registruj se</Link></p>
        <p>Zaboravljena šifra? <Link href="/auth/reset-password" className="text-blue-300">Resetuj</Link></p>
      </div>
    </div>
  );
}
