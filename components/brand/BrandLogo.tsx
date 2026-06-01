import Image from "next/image";
import { monogram } from "@/lib/brands";

/** Brand logo with a monogram fallback when no logo image is set. */
export function BrandLogo({
  src,
  name,
  size = 32,
  rounded = "rounded",
  className = "",
}: {
  src: string | null;
  name: string;
  size?: number;
  rounded?: string;
  className?: string;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`${rounded} ${className}`}
        priority
      />
    );
  }
  return (
    <div
      className={`${rounded} ${className} shrink-0 flex items-center justify-center bg-gold-500 text-black font-black`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-label={name}
    >
      {monogram(name)}
    </div>
  );
}
