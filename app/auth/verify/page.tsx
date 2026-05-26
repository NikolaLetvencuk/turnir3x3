import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  // After clicking the confirmation link, Supabase establishes the session
  // before redirecting here, so the user is already signed in.
  const user = await getCurrentUser();
  if (user) redirect("/");
  return (
    <div className="max-w-sm mx-auto card text-center space-y-3">
      <h1 className="text-xl font-semibold">Email potvrđen</h1>
      <p className="text-sm text-zinc-400">Tvoj nalog je aktiviran. Možeš se sad prijaviti.</p>
      <Link href="/auth/login" className="btn-primary inline-flex">Prijava</Link>
    </div>
  );
}
