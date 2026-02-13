import DashboardView from "@/src/components/DashboardView";
import { callGatewayRpc } from "@/src/lib/openclawGateway";
import type { Agent } from "@/src/types/agent";

export default function Home() {
  const agents = [{
    id: "alex-summarizer",
    name: "Alex 👾",
    status: "idle" as const,
    currentTask: "ZimZ Dashboard live – Tasks real!",
    modelType: "openrouter/x-ai/grok-4.1-fast",
    logs: ["Gateway Cron: Daily Report loaded", "Real data sync OK"],
    soulMd: "# Alex\n\nProaktiv, kurz, CNC/EVE-Fokus. Berlin TZ.",
    memoryMd: "# Memory\n\nUser workspace context loaded."
  }];

  return <DashboardView agents={agents} />;
}
