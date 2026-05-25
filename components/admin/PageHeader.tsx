import type { LucideIcon } from "lucide-react";

export function PageHeader({
  icon: Icon,
  title,
  hint,
  tone = "blue",
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  tone?: "blue" | "emerald" | "amber" | "purple" | "red";
  children?: React.ReactNode;
}) {
  const tones = {
    blue: "from-blue-500 to-blue-600",
    emerald: "from-emerald-500 to-emerald-600",
    amber: "from-amber-500 to-amber-600",
    purple: "from-purple-500 to-purple-600",
    red: "from-red-500 to-red-600",
  } as const;
  return (
    <div className={`rounded-xl p-4 sm:p-5 text-white bg-gradient-to-br ${tones[tone]}`}>
      <div className="flex items-center gap-3">
        <div className="shrink-0 w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center">
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold leading-tight">{title}</h1>
          {hint && <p className="text-sm text-white/85 mt-0.5">{hint}</p>}
        </div>
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
