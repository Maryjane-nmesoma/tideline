import { TransfersExplorer } from "@/components/transfers-view";
import { TransferCharts } from "@/components/transfer-charts";

export default function TransfersPage() {
  return <TransfersExplorer before={<TransferCharts />} />;
}
