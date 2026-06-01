import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { TopNav } from "@/components/nav/TopNav";
import { BottomNav } from "@/components/nav/BottomNav";
import { BackButton } from "@/components/nav/BackButton";
import { ToastProvider } from "@/components/ui/Toast";
import { getCurrentProfile } from "@/lib/auth";
import { getCurrentBrand } from "@/lib/brand-server";
import { DEFAULT_BRAND } from "@/lib/brands";

// Rich SEO copy used for the default (Kula) brand. Custom demo brands just
// use their own name for the title/OG.
const DEFAULT_TITLE = `${DEFAULT_BRAND.name} — 3x3 (3 na 3)`;
const DEFAULT_DESC =
  "Turnir u malom fudbalu 3 na 3 (3x3) u Kuli — Memorijalni Turnir Vladislav Petrovski, Liparski put. Uživo rezultati, raspored utakmica, tabele, strelci, žreb grupa, eliminacije i fantasy liga.";

export async function generateMetadata(): Promise<Metadata> {
  const brand = getCurrentBrand();
  const isDefault = brand.code === DEFAULT_BRAND.code;
  const title = isDefault ? DEFAULT_TITLE : brand.name;
  const desc = isDefault
    ? DEFAULT_DESC
    : `${brand.name} — uživo rezultati, raspored, tabele, strelci i fantasy liga.`;

  return {
    metadataBase: new URL("https://turnir3x3.vercel.app"),
    title: { default: title, template: `%s · ${brand.shortName}` },
    description: desc,
    keywords: [
      "turnir 3 na 3",
      "turnir 3x3",
      "3v3",
      "mali fudbal Kula",
      "turnir Kula",
      "Petrovski turnir",
      "Vladislav Petrovski",
      "Liparski put",
      "fudbalski turnir Kula",
      "3x3 turnir Srbija",
    ],
    viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
    // Stop Chrome from misdetecting the page as Slovenian and offering to
    // "translate" it (which would also flip Latin → Cyrillic).
    other: { google: "notranslate" },
    verification: { google: "5ptTftJjWmoj15gM7npOm1elTW5_lxuwpwwUVUueV7Q" },
    openGraph: {
      title,
      description: desc,
      url: "/",
      siteName: title,
      type: "website",
      locale: "sr_Latn_RS",
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description: desc, images: ["/og-image.png"] },
    icons: {
      icon: "/logo/mkpetrovski-gold.png",
      shortcut: "/logo/mkpetrovski-gold.png",
      apple: "/logo/mkpetrovski-gold.png",
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  const brand = getCurrentBrand();
  return (
    <html lang="sr-Latn-RS" translate="no">
      <body className="min-h-screen flex flex-col font-sans notranslate">
        <ToastProvider>
          <TopNav profile={profile} brandName={brand.shortName} brandLogo={brand.navLogo} />
          <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-4 pb-24 pt-4">
            <BackButton />
            {children}
          </main>
          <BottomNav isAuthed={!!profile} isAdmin={profile?.role === "admin"} />
        </ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
