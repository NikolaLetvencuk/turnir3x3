import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Shareable brand link: /...?t=NazivTurnira → set brand cookie. We KEEP the
  // ?t= param in the URL (no redirect) so social crawlers (Instagram, FB,
  // WhatsApp) — which don't send cookies — can read the brand for the link
  // preview (title + image). The cookie persists the brand across other pages.
  const t = request.nextUrl.searchParams.get("t");
  const brandCookie =
    t && process.env.NEXT_PUBLIC_DEMO_MODE === "true"
      ? encodeURIComponent(t.slice(0, 60))
      : null;
  // Set it on the REQUEST first so this same render (nav, watermark, hero) sees
  // the brand immediately — updateSession forwards request cookies to the app.
  if (brandCookie) request.cookies.set("brand", brandCookie);

  const res = await updateSession(request);

  // …and on the RESPONSE so the browser keeps it for subsequent pages.
  if (brandCookie) {
    res.cookies.set("brand", brandCookie, {
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
      sameSite: "lax",
    });
  }
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
