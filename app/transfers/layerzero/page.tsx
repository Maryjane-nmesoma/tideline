import { TransfersExplorer } from "@/components/transfers-view";
import { TransferCharts } from "@/components/transfer-charts";
import { RouteAnalytics } from "@/components/route-analytics";

export default function LayerZeroTransfersPage() {
  return (
    <TransfersExplorer
      lockedProtocol="layerzero"
      title="LayerZero messages touching Stellar"
      before={
        <>
          <TransferCharts />
          <RouteAnalytics />
        </>
      }
    />
  );
}
