import { ResetForm } from "./ResetForm";

export default function ResetPage({ searchParams }: { searchParams: { mode?: string } }) {
  const mode = searchParams.mode === "update" ? "update" : "request";
  return (
    <div className="max-w-sm mx-auto space-y-4">
      <h1 className="text-xl font-semibold">{mode === "update" ? "Nova šifra" : "Reset šifre"}</h1>
      <ResetForm mode={mode} />
    </div>
  );
}
