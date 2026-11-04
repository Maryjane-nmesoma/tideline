import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/50 border border-border/40",
        "before:absolute before:inset-0",
        "before:bg-gradient-to-r before:from-transparent before:via-muted-foreground/10 before:to-transparent",
        "before:animate-[shimmer_2s_ease-in-out_infinite]",
        className
      )}
      style={{
        "--shimmer-translate": "translateX(-100%)",
      } as React.CSSProperties}
      {...props}
    />
  )
}

export { Skeleton }
