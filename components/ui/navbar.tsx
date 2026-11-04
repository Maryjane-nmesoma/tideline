"use client";

import React, { memo, useState } from "react";
import { Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";

const TITLES: Record<string, string> = {
  "": "Cross-Chain Overview",
  transfers: "Transfer Explorer",
  corridors: "Corridors: Financial Institutions",
  liquidity: "Bridge Float and Reserves",
  "transfers/layerzero": "LayerZero Transfers",
  "transfers/cctp": "Circle CCTP Transfers",
  "tools/dust-calc": "Dust Calculator",
};

function titleFor(pathname: string) {
  const key = pathname.replace(/^\/+|\/+$/g, "");
  if (TITLES[key] !== undefined) return TITLES[key];
  if (key.startsWith("transfers/")) return "Transfer Details";
  if (key.startsWith("corridors/")) return "Institution";
  const seg = key.split("/").pop() ?? "";
  return seg
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

const Navbar = memo(function Navbar() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState("");

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/transfers?q=${encodeURIComponent(q)}`);
  };

  return (
    <nav className="sticky top-0 z-30 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center gap-3 px-4 sm:px-6">
        <div className="flex flex-1 items-center min-w-0">
          <SidebarTrigger className="mr-2 md:hidden" />
          <h1 className="truncate text-xl font-semibold text-foreground">
            {titleFor(pathname)}
          </h1>
        </div>

        <form
          onSubmit={onSearch}
          role="search"
          className="relative hidden w-full max-w-sm sm:block"
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tx hash, GUID, G... or C... address"
            aria-label="Search transfers"
            className="pl-10"
          />
        </form>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </div>
    </nav>
  );
});

export { Navbar };
