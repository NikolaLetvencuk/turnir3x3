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
};

// Known brands you pre-create for prospects (add a logo to /public/brands and
// a row here, then send them the `code` or `name` to type). Unknown names
// still work — they become an ad-hoc brand with a monogram logo.
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
 * - empty / demo off → default (Kula)
 * - matches a known code or name → that brand
 * - anything else → ad-hoc brand using the typed text as the name
 */
export function resolveBrand(input: string | undefined | null): Brand {
  if (!DEMO_MODE) return DEFAULT_BRAND;
  const raw = (input ?? "").trim();
  if (!raw) return DEFAULT_BRAND;

  const key = norm(raw);
  // exact code match
  if (BRANDS[key]) return BRANDS[key];
  // name match against known brands
  const byName = Object.values(BRANDS).find(
    (b) => norm(b.name) === key || norm(b.shortName) === key,
  );
  if (byName) return byName;

  // Ad-hoc brand from free text.
  const short = raw.length > 22 ? raw.slice(0, 22) : raw;
  return {
    code: "custom",
    name: raw,
    shortName: short,
    kicker: "Turnir",
    navLogo: null,
    heroLogo: null,
  };
}

export const BRAND_COOKIE = "brand";
