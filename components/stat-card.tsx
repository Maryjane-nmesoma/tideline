import { Info } from "lucide-react";
import { useState, ReactNode } from "react";
import { DownloadButton } from "@/components/ui/download-button";

interface StatCardProps {
  title: string;
  value: ReactNode;
  info?: string;
  elementId?: string;
  filename?: string;
}

export function StatCard({
  title,
  value,
  info,
  elementId,
  filename,
}: StatCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div id={elementId} className="h-full p-4 sm:p-6 border rounded-lg bg-card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs sm:text-sm font-medium text-muted-foreground truncate pr-2">
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {info && (
            <div className="relative flex-shrink-0">
              <Info
                className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground hover:text-foreground cursor-help transition-colors"
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              />
              {showTooltip && (
                <div className="absolute right-0 top-6 z-10 w-48 p-2 text-xs bg-popover border rounded-md shadow-md text-popover-foreground">
                  {info}
                </div>
              )}
            </div>
          )}

          {elementId && filename && (
            <DownloadButton
              elementId={elementId}
              filename={filename}
              size="sm"
              showText={false}
            />
          )}
        </div>
      </div>
      <div className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground break-words">
        {value}
      </div>
    </div>
  );
}
