import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile } from "@/lib/auth";
import { signOut } from "@/app/auth/actions";

export const revalidate = 0;

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/auth/login");

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <h1 className="text-xl font-semibold">Profil</h1>

      <div className="card space-y-2">
        <div>
          <div className="text-xs text-zinc-500">Email</div>
          <div className="font-medium truncate">{profile.email}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">Uloga</div>
          <div className="font-medium">{profile.role === "admin" ? "Administrator" : "Korisnik"}</div>
        </div>
      </div>

      <div className="space-y-2">
        <Link href="/fantasy" className="btn-secondary w-full">Fantasy</Link>
        <Link href="/fantasy/team" className="btn-secondary w-full">Moj tim</Link>
        <Link href="/fantasy/team/history" className="btn-secondary w-full">Istorija kola</Link>
        {profile.role === "admin" && <Link href="/admin" className="btn-primary w-full">Admin panel</Link>}
        <form action={signOut}>
          <button className="btn-danger w-full">Odjava</button>
        </form>
      </div>
    </div>
  );
}
