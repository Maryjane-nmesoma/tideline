import type { Metadata } from "next";
import "./globals.css";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/ui/app-sidebar";
import { Navbar } from "@/components/ui/navbar";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";

export const metadata: Metadata = {
  title: {
    default: "Tideline | Cross-Chain Intelligence for Stellar",
    template: "%s | Tideline",
  },
  description:
    "Track Circle CCTP, LayerZero OFT and Allbridge transfers into and out of Stellar. See why a transfer is delayed, check bridge float, and avoid 7 vs 6 decimal dust loss.",
  keywords: [
    "Stellar",
    "Soroban",
    "Cross-chain",
    "CCTP",
    "LayerZero",
    "USDT0",
    "USDC",
    "Allbridge",
    "Bridge explorer",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Tideline | Cross-Chain Intelligence for Stellar",
    description:
      "One search bar for every cross-chain transfer touching Stellar, with failure diagnostics and bridge float monitoring.",
    siteName: "Tideline",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>
                <Navbar />
                <div className="flex-1">{children}</div>
              </SidebarInset>
            </SidebarProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
