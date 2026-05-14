import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";

export const revalidate = 0;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") redirect("/auth/login?next=/admin");

  const tabs = [
    ["/admin", "Pregled"],
    ["/admin/teams", "Timovi"],
    ["/admin/players", "Igrači"],
    ["/admin/groups", "Grupe"],
    ["/admin/rounds", "Kola"],
    ["/admin/matches", "Mečevi"],
    ["/admin/bracket", "Eliminacije"],
    ["/admin/fantasy", "Fantasy"],
  ] as const;

  return (
    <div>
      <div className="card mb-4 overflow-x-auto">
        <nav className="flex gap-1 text-sm whitespace-nowrap">
          {tabs.map(([href, label]) => (
            <Link key={href} href={href} className="px-3 py-1.5 rounded-md hover:bg-zinc-100">{label}</Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
