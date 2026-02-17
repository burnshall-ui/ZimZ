import DashboardView from "@/src/components/DashboardView";
import { callGatewayRpc } from "@/src/lib/openclawGateway";
import {
  gatewayEntryToAgent,
  type Agent,
  type AgentsListResponse,
  type GatewayAgentEntry,
} from "@/src/types/agent";

// Force dynamic rendering (SSR, not SSG)
export const dynamic = "force-dynamic";

async function getAgents(): Promise<Agent[]> {
  try {
    // Direct Gateway RPC call (server-side, no self-fetch needed)
    const result = await callGatewayRpc<AgentsListResponse>("agents.list");
    const rawAgents: GatewayAgentEntry[] = result.agents ?? result.list ?? [];
    return rawAgents.map(gatewayEntryToAgent);
  } catch (error) {
    console.error("[SSR] Failed to load agents from Gateway:", error);
    return [];
  }
}

export default async function Home() {
  const agents = await getAgents();

  return <DashboardView agents={agents} />;
}
