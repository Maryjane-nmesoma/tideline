import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "Could not load data",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <AlertTriangle className="h-5 w-5 text-destructive" />
      <p className="text-sm font-medium">{title}</p>
      {message && <p className="max-w-md text-sm text-muted-foreground break-words">{message}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Inbox className="h-5 w-5 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {message && <p className="max-w-md text-sm text-muted-foreground">{message}</p>}
      {action}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  id,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <section id={id} className={`border rounded-lg bg-card p-4 sm:p-6 ${className}`}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="space-y-4 p-4 sm:p-6">{children}</div>;
}
