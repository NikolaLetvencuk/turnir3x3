import "server-only";
import { cookies } from "next/headers";
import { BRAND_COOKIE, resolveBrand, type Brand } from "@/lib/brands";

/** Resolve the active brand for the current request from the brand cookie. */
export function getCurrentBrand(): Brand {
  const value = cookies().get(BRAND_COOKIE)?.value;
  return resolveBrand(value ? decodeURIComponent(value) : null);
}

/** Whether the visitor has already made (or skipped) a brand choice. */
export function hasBrandChoice(): boolean {
  return cookies().get(BRAND_COOKIE) !== undefined;
}
