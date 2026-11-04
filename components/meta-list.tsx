import { ExternalLink } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/utils";
import type { MetaRow } from "@/lib/types";

function shorten(v: string) {
  return v.length > 46 ? `${v.slice(0, 22)}...${v.slice(-16)}` : v;
}

export function MetaList({ rows }: { rows: MetaRow[] }) {
  return (
    <dl className="divide-y">
      {rows.map((r, i) => (
        <div
          key={`${r.label}-${i}`}
          className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
        >
          <dt className="shrink-0 text-sm text-muted-foreground">{r.label}</dt>
          <dd className="flex min-w-0 items-center gap-1.5 text-sm sm:justify-end">
            <span
              title={r.value}
              className={cn("min-w-0", r.mono ? "font-mono text-xs break-all" : "sm:text-right")}
            >
              {r.mono ? shorten(r.value) : r.value}
            </span>
            {r.copy && <CopyButton value={r.value} label={`Copy ${r.label}`} />}
            {r.href && (
              <a href={r.href} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="sr-only">Open</span>
              </a>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
