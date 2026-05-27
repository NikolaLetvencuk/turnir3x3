import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { TopNav } from "@/components/nav/TopNav";
import { BottomNav } from "@/components/nav/BottomNav";
import { BackButton } from "@/components/nav/BackButton";
import { ToastProvider } from "@/components/ui/Toast";
import { getCurrentProfile } from "@/lib/auth";

const TITLE = 'Memorijalni Turnir "Vladislav Petrovski" Kula';
const DESC =
  "Pratite rezultate, tabele i fantasy ligu — Memorijalni Turnir Vladislav Petrovski, Liparski put, Kula.";

export const metadata: Metadata = {
  metadataBase: new URL("https://turnir3x3.vercel.app"),
  title: {
    default: TITLE,
    template: `%s · ${TITLE}`,
  },
  description: DESC,
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
  openGraph: {
    title: TITLE,
    description: DESC,
    url: "/",
    siteName: TITLE,
    type: "website",
    locale: "sr_Latn_RS",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/logo/mkpetrovski-gold.png",
    shortcut: "/logo/mkpetrovski-gold.png",
    apple: "/logo/mkpetrovski-gold.png",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  return (
    <html lang="sr-Latn">
      <body className="min-h-screen flex flex-col font-sans">
        <ToastProvider>
          <TopNav profile={profile} />
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
