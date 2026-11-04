"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadElementAsPng } from "@/lib/download";
import { cn } from "@/lib/utils";

interface DownloadButtonProps {
  elementId: string;
  filename: string;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg";
  showText?: boolean;
}

export function DownloadButton({
  elementId,
  filename,
  className,
  variant = "outline",
  size = "sm",
  showText = true,
}: DownloadButtonProps) {
  const handleDownload = () => {
    const element = document.getElementById(elementId);
    if (element) {
      downloadElementAsPng(element, filename);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleDownload}
      className={cn("exclude-from-export", className)}
    >
      <Download className="h-4 w-4" />
      {showText && <span className="ml-1">Download</span>}
    </Button>
  );
}
