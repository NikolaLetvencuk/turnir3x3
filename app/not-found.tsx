import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card text-center">
      <h2 className="font-semibold mb-2">Stranica nije pronađena</h2>
      <p className="text-sm text-zinc-600 mb-4">Tražena stranica ne postoji.</p>
      <Link href="/" className="btn-primary inline-flex">Početna</Link>
    </div>
  );
}
