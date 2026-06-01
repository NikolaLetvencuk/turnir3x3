import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Shareable brand link: /...?t=NazivTurnira → set brand cookie, strip param.
  const t = request.nextUrl.searchParams.get("t");
  if (t && process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    const url = request.nextUrl.clone();
    url.searchParams.delete("t");
    const res = NextResponse.redirect(url);
    res.cookies.set("brand", encodeURIComponent(t.slice(0, 60)), {
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
      sameSite: "lax",
    });
    return res;
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
