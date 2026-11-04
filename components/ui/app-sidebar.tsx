"use client";
import React, { memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Calculator,
  Droplets,
  Globe,
  Landmark,
  Layers,
  Network,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Wordmark } from "@/components/logo";
import { InstitutionLogo } from "@/components/institution-logo";
import { useInstitutions } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

type NavItem = { title: string; url: string; icon: LucideIcon; match: (pathname: string) => boolean };

const exact = (url: string) => (p: string) => p === url;
const starts = (url: string) => (p: string) => p === url || p.startsWith(`${url}/`);

const intelligence: NavItem[] = [
  { title: "Overview", url: "/", icon: Globe, match: exact("/") },
  { title: "Liquidity", url: "/liquidity", icon: Droplets, match: starts("/liquidity") },
];

const crossChain: NavItem[] = [
  {
    title: "All Transfers",
    url: "/transfers",
    icon: ArrowLeftRight,
    // Transfer detail pages live under /transfers/<id>, which is not the LayerZero or CCTP listing.
    match: (p) => p === "/transfers" || (p.startsWith("/transfers/") && !/^\/transfers\/(layerzero|cctp)/.test(p)),
  },
  { title: "LayerZero", url: "/transfers/layerzero", icon: Network, match: starts("/transfers/layerzero") },
  { title: "Circle CCTP", url: "/transfers/cctp", icon: Layers, match: starts("/transfers/cctp") },
];

const tools: NavItem[] = [
  { title: "Dust Calculator", url: "/tools/dust-calc", icon: Calculator, match: starts("/tools/dust-calc") },
];

const itemClass = "text-sm font-medium hover:bg-accent/50 transition-colors";

function Item({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate: () => void }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={item.match(pathname)} className={itemClass}>
        <Link href={item.url} onClick={onNavigate}>
          <item.icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-foreground/90">{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function Section({
  label,
  primary,
  children,
}: {
  label: string;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel
        className={cn(
          "text-xs font-semibold uppercase tracking-wider",
          primary ? "text-primary" : "text-muted-foreground/80"
        )}
      >
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">{children}</SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function InstitutionItems({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const { data, isLoading, error } = useInstitutions();

  if (isLoading) {
    return (
      <>
        {Array.from({ length: 6 }).map((_, i) => (
          <SidebarMenuItem key={i} className="flex h-8 items-center gap-2 px-2">
            <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" style={{ maxWidth: `${60 + ((i * 17) % 35)}%` }} />
          </SidebarMenuItem>
        ))}
      </>
    );
  }
  if (error || !data) {
    return <li className="px-2 py-1 text-xs text-muted-foreground">Could not load institutions.</li>;
  }
  return (
    <>
      <Item
        item={{ title: "All Institutions", url: "/corridors", icon: Landmark, match: exact("/corridors") }}
        pathname={pathname}
        onNavigate={onNavigate}
      />
      {data.institutions.map((inst) => (
        <SidebarMenuItem key={inst.slug}>
          <SidebarMenuButton
            asChild
            isActive={starts(`/corridors/${inst.slug}`)(pathname)}
            className={itemClass}
          >
            <Link href={`/corridors/${inst.slug}`} onClick={onNavigate}>
              <InstitutionLogo name={inst.name} src={inst.logo} className="h-4 w-4 text-[9px]" />
              <span className="truncate text-foreground/90">{inst.name}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </>
  );
}

const AppSidebar = memo(function AppSidebar() {
  const pathname = usePathname() ?? "/";
  const { setOpenMobile, isMobile } = useSidebar();

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar>
      {/* h-16 matches the navbar so the two bottom borders sit on the same line */}
      <SidebarHeader className="h-16 flex-row items-center justify-between gap-2 border-b border-sidebar-border px-4 py-0">
        <Link href="/" onClick={closeOnMobile} className="text-primary">
          <Wordmark />
        </Link>
        {isMobile && (
          <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setOpenMobile(false)}>
            <X className="h-4 w-4" />
            <span className="sr-only">Close menu</span>
          </Button>
        )}
      </SidebarHeader>
      <SidebarContent className="no-scrollbar">
        <Section label="Intelligence" primary>
          {intelligence.map((i) => (
            <Item key={i.url} item={i} pathname={pathname} onNavigate={closeOnMobile} />
          ))}
        </Section>
        <Section label="Cross-Chain">
          {crossChain.map((i) => (
            <Item key={i.url} item={i} pathname={pathname} onNavigate={closeOnMobile} />
          ))}
        </Section>
        <Section label="Tools">
          {tools.map((i) => (
            <Item key={i.url} item={i} pathname={pathname} onNavigate={closeOnMobile} />
          ))}
        </Section>
        <Section label="Corridors">
          <InstitutionItems pathname={pathname} onNavigate={closeOnMobile} />
        </Section>
      </SidebarContent>
    </Sidebar>
  );
});

export { AppSidebar };
