import DashboardView from "@/src/components/DashboardView";
import { mockAgents } from "@/src/data/mockData";

export default function Home() {
  return <DashboardView agents={mockAgents} />;
}
