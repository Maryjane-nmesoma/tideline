import { AlertTriangle, Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import type { PipelineStep } from "@/lib/types";

function Icon({ state }: { state: PipelineStep["state"] }) {
  switch (state) {
    case "done":
      return <Check className="h-4 w-4" />;
    case "active":
      return <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />;
    case "failed":
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <Circle className="h-3 w-3" />;
  }
}

const TONE: Record<PipelineStep["state"], string> = {
  done: "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400",
  active: "border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-400",
  failed: "border-red-600/30 bg-red-600/10 text-red-700 dark:text-red-400",
  pending: "border-border bg-muted/50 text-muted-foreground",
};

export function PipelineSteps({ steps }: { steps: PipelineStep[] }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-4">
      {steps.map((s, i) => (
        <li key={s.key} className="relative flex gap-3 sm:flex-col">
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className="absolute left-4 top-9 h-[calc(100%-1.5rem)] w-px bg-border sm:left-9 sm:top-4 sm:h-px sm:w-[calc(100%-1.5rem)]"
            />
          )}
          <span
            className={cn(
              "relative z-0 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
              TONE[s.state]
            )}
          >
            <Icon state={s.state} />
          </span>
          <div className="min-w-0 pb-2">
            <p className={cn("text-sm font-medium", s.state === "pending" && "text-muted-foreground")}>
              {s.label}
            </p>
            {s.detail && <p className="mt-0.5 text-xs text-muted-foreground">{s.detail}</p>}
            {s.timestamp ? (
              <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{formatDateTime(s.timestamp)}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
