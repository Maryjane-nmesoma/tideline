import { cn } from "@/lib/utils";

/** Tideline mark: a tide wave above the line it reaches. Uses currentColor so it follows the theme. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg bg-foreground text-background",
        className
      )}
    >
      <svg viewBox="0 0 32 32" fill="none" className="h-full w-full" aria-hidden>
        <path
          d="M6 15C10 8.5 14 8.5 16 15S22 21.5 26 15"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M6 23.5H26" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" opacity="0.5" />
      </svg>
    </span>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="h-8 w-8" />
      <span className="text-lg font-bold tracking-tight">Tideline</span>
    </span>
  );
}
