/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

export function InstitutionLogo({ name, src, className }: { name: string; src: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-xs font-semibold text-muted-foreground",
        className
      )}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}
