"use client";

import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

type ActionResult = { ok: true } | { ok: false; error: string };

export function SubmitButton({ children, className = "btn-primary" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={className}>{pending ? "..." : children}</button>;
}

export function HandleResult({ result }: { result?: ActionResult }) {
  return null; // placeholder; results are surfaced via wrapper
}

export function useActionRunner() {
  const router = useRouter();
  const { push } = useToast();
  return async function run(action: (fd: FormData) => Promise<ActionResult>, fd: FormData, opts?: { onSuccess?: () => void; successMessage?: string }) {
    const res = await action(fd);
    if (!res.ok) { push(res.error, "error"); return false; }
    push(opts?.successMessage ?? "Sačuvano", "success");
    opts?.onSuccess?.();
    router.refresh();
    return true;
  };
}
