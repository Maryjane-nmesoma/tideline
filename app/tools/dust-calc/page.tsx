"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageShell, Panel } from "@/components/states";
import { analyzeInbound, analyzeOutbound, dustFreeAmount, formatUnits } from "@/lib/dust";
import { cn } from "@/lib/utils";

type Mode = "outbound" | "inbound";

const EXAMPLES: Record<Mode, string[]> = {
  outbound: ["1.2345678", "100.0000001", "2500.5", "0.0000009"],
  inbound: ["1.234567", "100", "0.000001"],
};

function Field({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "warn" | "ok" }) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        tone === "warn" && "border-amber-600/40 bg-amber-600/5",
        tone === "ok" && "border-green-600/30 bg-green-600/5"
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-all font-mono text-lg font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function DustCalcPage() {
  const [mode, setMode] = useState<Mode>("outbound");
  const [input, setInput] = useState("1.2345678");

  const out = useMemo(() => (mode === "outbound" ? analyzeOutbound(input) : null), [mode, input]);
  const inn = useMemo(() => (mode === "inbound" ? analyzeInbound(input) : null), [mode, input]);
  const error = (out && !out.ok && out.message) || (inn && !inn.ok && inn.message) || null;

  return (
    <PageShell>
      <Panel title="7 vs 6 decimal dust calculator" id="dust-calc">
        <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
          Stellar tokens have 7 decimals (stroops). Circle CCTP and LayerZero OFT carry 6. Sending out of Stellar
          drops the last digit. Circle CCTP and LayerZero remove that remainder before sending, so it is not burned and stays in your account, but it never arrives.
        </p>

        <div className="mb-4 flex gap-1 self-start rounded-md border p-1 w-fit" role="group" aria-label="Direction">
          {(["outbound", "inbound"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                setInput(EXAMPLES[m][0]);
              }}
              className={cn(
                "rounded px-3 py-1.5 text-sm transition-colors",
                mode === m ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              {m === "outbound" ? "Out of Stellar (7 to 6)" : "Into Stellar (6 to 7)"}
            </button>
          ))}
        </div>

        <label htmlFor="amount" className="mb-2 block text-sm font-medium">
          Amount to send ({mode === "outbound" ? "Stellar, up to 7 decimals" : "source chain, up to 6 decimals"})
        </label>
        <Input
          id="amount"
          inputMode="decimal"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="max-w-md font-mono"
          aria-invalid={!!error}
          aria-describedby={error ? "amount-error" : undefined}
        />
        {error && (
          <p id="amount-error" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES[mode].map((ex) => (
            <Button key={ex} type="button" variant="outline" size="sm" onClick={() => setInput(ex)}>
              {ex}
            </Button>
          ))}
        </div>
      </Panel>

      {out?.ok && (
        <Panel title="Result">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="You send (Stellar, 7 decimals)" value={out.inputDisplay} />
            <Field label="Crosses (wire, 6 decimals)" value={out.wireDisplay} />
            <Field
              label="Stays behind"
              value={out.hasDust ? out.dustDisplay : "0"}
              tone={out.hasDust ? "warn" : "ok"}
              hint={out.hasDust ? "Not sent, remains in your account" : undefined}
            />
          </div>
          {out.hasDust ? (
            <div className="mt-4 flex gap-3 rounded-lg border border-amber-600/30 bg-amber-600/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0">
                <p className="font-medium">
                  {out.dustStroops.toString()} stroop{out.dustStroops === BigInt(1) ? "" : "s"} will not cross.
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  Send{" "}
                  <button
                    type="button"
                    className="font-mono underline underline-offset-2 hover:text-foreground"
                    onClick={() => setInput(formatUnits(dustFreeAmount(out.stroops), 7))}
                  >
                    {formatUnits(dustFreeAmount(out.stroops), 7)}
                  </button>{" "}
                  instead to send the whole amount. Apps that expect the full 7-decimal amount on arrival can fail or show the wrong figure.
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex gap-3 rounded-lg border border-green-600/30 bg-green-600/5 p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              <p>This amount converts exactly. All of it crosses.</p>
            </div>
          )}
        </Panel>
      )}

      {inn?.ok && (
        <Panel title="Result">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Burned or locked (wire, 6 decimals)" value={inn.wireDisplay} />
            <Field label="Credited on Stellar (7 decimals)" value={inn.stellarDisplay} tone="ok" />
          </div>
          <div className="mt-4 flex gap-3 rounded-lg border border-green-600/30 bg-green-600/5 p-3 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
            <p>Going from 6 to 7 decimals is exact. The remainder only appears when leaving Stellar.</p>
          </div>
        </Panel>
      )}
    </PageShell>
  );
}
