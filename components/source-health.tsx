"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useHealth } from "@/hooks/use-api";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, Panel } from "@/components/states";

export function SourceHealth() {
  const { data, isLoading, error, refetch } = useHealth();
  return (
    <Panel title="Data sources" id="source-health">
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : error || !data ? (
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      ) : (
        <ul className="space-y-3">
          {data.sources.map((s) => (
            <li key={s.source} className="flex items-start gap-2 text-sm">
              {s.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              )}
              <div className="min-w-0">
                <p className="font-medium">{s.source}</p>
                <p className="text-xs text-muted-foreground">
                  {s.ok ? `Responding in ${s.ms} ms` : (s.message ?? "Unavailable")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
