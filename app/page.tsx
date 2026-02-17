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

/** Response from agents.files.get RPC */
interface AgentFileGetResponse {
  file: { missing: boolean; content?: string };
}

async function getAgentFile(agentId: string, name: string): Promise<string | undefined> {
  try {
    const res = await callGatewayRpc<AgentFileGetResponse>("agents.files.get", { agentId, name });
    if (res.file?.missing) return undefined;
    return res.file?.content;
  } catch {
    return undefined;
  }
}

async function getAgents(): Promise<Agent[]> {
  try {
    // Direct Gateway RPC call (server-side, no self-fetch needed)
    const result = await callGatewayRpc<AgentsListResponse>("agents.list");
    const rawAgents: GatewayAgentEntry[] = result.agents ?? result.list ?? [];

    // Enrich each agent with SOUL.md and MEMORY.md
    const enriched = await Promise.all(
      rawAgents.map(async (entry) => {
        const [soulMd, memoryMd] = await Promise.all([
          getAgentFile(entry.id, "SOUL.md"),
          getAgentFile(entry.id, "MEMORY.md"),
        ]);
        return { ...entry, soulMd, memoryMd };
      }),
    );

    return enriched.map(gatewayEntryToAgent);
  } catch (error) {
    console.error("[SSR] Failed to load agents from Gateway:", error);
    return [];
  }
}

export default async function Home() {
  const agents = await getAgents();

  return <DashboardView agents={agents} />;
}
