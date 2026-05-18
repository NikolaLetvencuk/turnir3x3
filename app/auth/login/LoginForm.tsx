"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useState } from "react";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

const schema = z.object({
  email: z.string().email("Neispravan email"),
  password: z.string().min(6, "Najmanje 6 znakova"),
});
type FormData = z.infer<typeof schema>;

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(data);
    setLoading(false);
    if (error) { push(error.message, "error"); return; }
    push("Uspešna prijava", "success");
    router.push(next);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="card space-y-3">
        <GoogleSignInButton next={next} />
        <div className="flex items-center gap-3 text-xs text-zinc-400 uppercase tracking-wider">
          <div className="flex-1 h-px bg-zinc-200" />
          ili
          <div className="flex-1 h-px bg-zinc-200" />
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" autoComplete="email" {...register("email")} />
            {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
          </div>
          <div>
            <label className="label">Šifra</label>
            <input className="input" type="password" autoComplete="current-password" {...register("password")} />
            {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>}
          </div>
          <button disabled={loading} className="btn-primary w-full">{loading ? "..." : "Prijavi se"}</button>
        </form>
      </div>
    </div>
  );
}
