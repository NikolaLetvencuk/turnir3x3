"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { BRAND_COOKIE, DEMO_MODE } from "@/lib/brands";

export async function setBrand(name: string): Promise<{ ok: boolean }> {
  if (!DEMO_MODE) return { ok: false };
  const trimmed = (name ?? "").trim().slice(0, 60);
  const store = cookies();
  if (!trimmed) {
    store.delete(BRAND_COOKIE);
  } else {
    store.set(BRAND_COOKIE, encodeURIComponent(trimmed), {
      path: "/",
      maxAge: 60 * 60 * 24 * 180, // 180 days
      sameSite: "lax",
    });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function clearBrand(): Promise<{ ok: boolean }> {
  cookies().delete(BRAND_COOKIE);
  revalidatePath("/", "layout");
  return { ok: true };
}
