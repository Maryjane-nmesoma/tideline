import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TransferStatus } from "@/lib/types";

const META: Record<TransferStatus, { label: string; className: string }> = {
  completed: {
    label: "Completed",
    className: "border-green-600/25 bg-green-600/10 text-green-700 dark:text-green-400",
  },
  attested: {
    label: "Attested",
    className: "border-sky-600/25 bg-sky-600/10 text-sky-700 dark:text-sky-400",
  },
  attesting: {
    label: "Attesting",
    className: "border-blue-600/25 bg-blue-600/10 text-blue-700 dark:text-blue-400",
  },
  relaying: {
    label: "Relaying",
    className: "border-amber-600/25 bg-amber-600/10 text-amber-700 dark:text-amber-400",
  },
  stalled: {
    label: "Stalled",
    className: "border-red-600/25 bg-red-600/10 text-red-700 dark:text-red-400",
  },
  failed: {
    label: "Failed",
    className: "border-red-600/40 bg-red-600/15 text-red-700 dark:text-red-400",
  },
};

export const STATUS_LABELS = META;

export function StatusBadge({ status, className }: { status: TransferStatus; className?: string }) {
  const m = META[status];
  return (
    <Badge variant="outline" className={cn("font-medium", m.className, className)}>
      {m.label}
    </Badge>
  );
}
