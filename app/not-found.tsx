import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative flex min-h-[70vh] items-center justify-center px-4 sm:px-6">
      {/* Soft background accents that adapt to theme */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl dark:bg-primary/10" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl dark:bg-primary/10" />
      </div>

      <div className="mx-auto w-full max-w-3xl text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border bg-background/60 shadow-sm backdrop-blur-sm sm:h-16 sm:w-16">
          <Search className="h-6 w-6 text-primary sm:h-7 sm:w-7" />
        </div>

        <h1 className="bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-6xl">
          404
        </h1>
        <p className="mt-3 text-lg font-semibold text-foreground/90 sm:text-xl">
          Page not found
        </p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
          The page you are looking for does not exist or may have been moved. You
          can go back or jump to the dashboard overview.
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go back home
            </Link>
          </Button>

          <Button asChild className="w-full sm:w-auto">
            <Link href="/transfers">Open Transfer Explorer</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
