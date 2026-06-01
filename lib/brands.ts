// Demo branding layer. The app shows the SAME data to everyone; only the
// displayed name + logo change based on a chosen "brand". Real customers get
// their own cloned deploy with DEMO_MODE off, so they never see the picker
// and always get the default brand baked into that clone.

export type Brand = {
  code: string;
  /** Full display name (title, hero headline, OG). */
  name: string;
  /** Short label for the navbar. */
  shortName: string;
  /** Small line shown above the headline in the hero. */
  kicker: string;
  /** Logo for light/navbar surfaces (white-bg ok). null → monogram fallback. */
  navLogo: string | null;
  /** Logo for the blue hero block. null → monogram fallback. */
  heroLogo: string | null;
  /** Hero gradient colors (hex). Defaults to blue if omitted. */
  heroFrom: string;
  heroTo: string;
};

// Demo mode is ON only on the main demo site (env flag). In a customer clone
// the flag is unset → fixed default brand, no picker, no "enter name" screen.
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const DEFAULT_BRAND: Brand = {
  code: "kula",
  name: 'Memorijalni Turnir "Vladislav Petrovski" Kula',
  shortName: "Petrovski Kula",
  kicker: "Memorijalni Turnir",
  navLogo: "/logo/logomkpetrovskibela_pozadina.png",
  heroLogo: "/logo/mkpetrovski.png",
  heroFrom: "#2563eb", // blue-600
  heroTo: "#1d4ed8", // blue-700
};

// Known brands you pre-create for prospects. To add one:
//   1. Put the logo files in /public/brands/<code>/ (see PROJECT_GUIDE.md §7).
//   2. Add a row below.
//   3. Send the prospect the `code` (or `name`) to type, or a link /?t=<code>.
// Unknown / closed input falls back to DEFAULT_BRAND (Petrovski).
//
// Example (uncomment + drop logo files to enable):
//   krstur: {
//     code: "krstur",
//     name: "Turnir Krstur",
//     shortName: "Krstur",
//     kicker: "Turnir",
//     navLogo: "/brands/krstur/nav.png",
//     heroLogo: "/brands/krstur/hero.png",
//     heroFrom: "#c81e1e", // crvena
//     heroTo: "#7f1212",
//   },
export const BRANDS: Record<string, Brand> = {
  kula: DEFAULT_BRAND,
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Monogram (up to 2 letters) from a name, for the logo fallback. */
export function monogram(name: string): string {
  const words = name.replace(/["'„""]/g, "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "T";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Resolve a brand from a cookie/URL value.
 * - empty / demo off / unknown name → default (Petrovski Kula)
 * - matches a known code or name → that brand
 * Only pre-created brands show; anything else falls back to default.
 */
export function resolveBrand(input: string | undefined | null): Brand {
  if (!DEMO_MODE) return DEFAULT_BRAND;
  const raw = (input ?? "").trim();
  if (!raw) return DEFAULT_BRAND;

  const key = norm(raw);
  if (BRANDS[key]) return BRANDS[key];
  const byName = Object.values(BRANDS).find(
    (b) => norm(b.name) === key || norm(b.shortName) === key,
  );
  return byName ?? DEFAULT_BRAND;
}

/** True if the input matches a known non-default brand (for picker feedback). */
export function isKnownBrand(input: string): boolean {
  const key = norm(input.trim());
  if (!key) return false;
  if (BRANDS[key] && key !== DEFAULT_BRAND.code) return true;
  return Object.values(BRANDS).some(
    (b) => b.code !== DEFAULT_BRAND.code && (norm(b.name) === key || norm(b.shortName) === key),
  );
}

export const BRAND_COOKIE = "brand";
