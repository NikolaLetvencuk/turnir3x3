import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "@/components/nav/TopNav";
import { BottomNav } from "@/components/nav/BottomNav";
import { ToastProvider } from "@/components/ui/Toast";
import { getCurrentProfile } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Turnir Kula 3v3",
  description: "Pratite rezultate, tabele i fantasy ligu — turnir Kula, Liparski put",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  return (
    <html lang="sr-Latn">
      <body className="min-h-screen flex flex-col font-sans">
        <ToastProvider>
          <TopNav profile={profile} />
          <main className="flex-1 w-full max-w-5xl mx-auto px-4 pb-24 pt-4">
            {children}
          </main>
          <BottomNav isAuthed={!!profile} isAdmin={profile?.role === "admin"} />
        </ToastProvider>
      </body>
    </html>
  );
}
