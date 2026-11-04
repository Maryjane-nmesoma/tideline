import { Badge } from "@/components/ui/badge";
import type { Protocol } from "@/lib/types";

const LABELS: Record<Protocol, string> = {
  layerzero: "LayerZero",
  cctp: "Circle CCTP",
  allbridge: "Allbridge",
};

export function ProtocolBadge({ protocol }: { protocol: Protocol }) {
  return (
    <Badge variant="secondary" className="font-medium">
      {LABELS[protocol]}
    </Badge>
  );
}
