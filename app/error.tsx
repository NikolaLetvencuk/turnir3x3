"use client";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card text-center">
      <h2 className="font-semibold mb-2">Došlo je do greške</h2>
      <p className="text-sm text-zinc-400 mb-4">{error.message || "Neočekivana greška."}</p>
      <button className="btn-primary" onClick={reset}>Pokušaj ponovo</button>
    </div>
  );
}
