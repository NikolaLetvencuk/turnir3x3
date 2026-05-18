import Link from "next/link";
import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return (
    <div className="max-w-sm mx-auto space-y-4">
      <h1 className="text-xl font-semibold">Registracija</h1>
      <RegisterForm />
      <p className="text-sm text-zinc-600">Već imaš nalog? <Link href="/auth/login" className="text-blue-700">Prijavi se</Link></p>
    </div>
  );
}
