import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default function LoginPage({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <div className="max-w-sm mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Prijava</h1>
      <LoginForm next={searchParams.next ?? "/"} />
      <div className="text-sm text-zinc-600 space-y-1">
        <p>Nemaš nalog? <Link href="/auth/register" className="text-blue-700">Registruj se</Link></p>
        <p>Zaboravljena šifra? <Link href="/auth/reset-password" className="text-blue-700">Resetuj</Link></p>
      </div>
    </div>
  );
}
