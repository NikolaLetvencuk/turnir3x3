import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { RegisterForm } from "./RegisterForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  return (
    <div className="max-w-sm mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Registracija</h1>
      <RegisterForm />
      <p className="text-sm text-zinc-400">Već imaš nalog? <Link href="/auth/login" className="text-blue-300">Prijavi se</Link></p>
    </div>
  );
}
