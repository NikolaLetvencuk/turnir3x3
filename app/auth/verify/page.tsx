import Link from "next/link";

export default function VerifyPage() {
  return (
    <div className="max-w-sm mx-auto card text-center space-y-3">
      <h1 className="text-xl font-semibold">Email potvrđen</h1>
      <p className="text-sm text-zinc-600">Tvoj nalog je aktiviran. Možeš se sad prijaviti.</p>
      <Link href="/auth/login" className="btn-primary inline-flex">Prijava</Link>
    </div>
  );
}
