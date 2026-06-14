import Link from "next/link";
import { redirect } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  User,
  Sparkles,
  ListChecks,
  Trophy as Cup,
  Megaphone,
  Share2,
  AlertTriangle,
  Crown,
} from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { getCurrentBrand } from "@/lib/brand-server";
import { BrandLogo } from "@/components/brand/BrandLogo";

export const revalidate = 0;

const NAV: Array<{
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "danger";
}> = [
  { href: "/admin", label: "Pregled", icon: LayoutDashboard },
  { href: "/admin/teams", label: "Timovi", icon: Users },
  { href: "/admin/players", label: "Igrači", icon: User },
  { href: "/admin/draw", label: "Žreb", icon: Sparkles },
  { href: "/admin/matches", label: "Mečevi", icon: ListChecks },
  { href: "/admin/bracket", label: "Eliminacije", icon: Cup },
  { href: "/admin/users", label: "Korisnici", icon: Crown },
  { href: "/admin/news", label: "Vesti", icon: Megaphone },
  { href: "/admin/export", label: "Export", icon: Share2 },
  { href: "/admin/danger-zone", label: "Reset", icon: AlertTriangle, tone: "danger" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "scorer")) redirect("/auth/login?next=/admin");

  const isScorer = profile.role === "scorer";
  // Scorer (result-entry operator) sees only the Matches + Export tabs.
  const scorerHrefs = ["/admin/matches", "/admin/export"];
  const nav = isScorer ? NAV.filter((n) => scorerHrefs.includes(n.href)) : NAV;

  const brand = getCurrentBrand();

  return (
    <div className="space-y-4">
      {/* Brand strip */}
      <div className="flex items-center gap-3 px-2">
        <BrandLogo src={brand.navLogo} name={brand.name} size={48} rounded="rounded-md" />
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-zinc-500">{isScorer ? "Unos rezultata" : "Admin panel"}</div>
          <div className="font-bold truncate leading-tight">{brand.shortName}</div>
          <div className="text-[11px] text-zinc-500 truncate">{brand.kicker}</div>
        </div>
      </div>

      {/* Module grid — tap-friendly tiles, no horizontal scrolling.
          Scorer sees only the Matches + Export tiles. */}
      <nav className={isScorer ? "grid grid-cols-2 gap-2" : "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2"}>
        {nav.map(({ href, label, icon: Icon, tone }) => (
          <Link
            key={href}
            href={href}
            className={`group flex flex-col items-center justify-center gap-1 py-3 rounded-xl border transition ${
              tone === "danger"
                ? "border-red-200 bg-red-50 hover:bg-red-100 text-red-700"
                : "border-zinc-800 bg-zinc-900 hover:bg-blue-50 hover:border-blue-300 text-zinc-300"
            }`}
          >
            <Icon className={`w-6 h-6 ${tone === "danger" ? "text-red-600" : "text-blue-600 group-hover:text-blue-300"}`} />
            <span className="text-xs font-medium">{label}</span>
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
