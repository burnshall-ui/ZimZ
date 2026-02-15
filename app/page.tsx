import DashboardView from "@/src/components/DashboardView";
import type { Agent } from "@/src/types/agent";

// Force dynamic rendering (don't pre-render at build time)
export const dynamic = "force-dynamic";

async function getAgents(): Promise<Agent[]> {
  try {
    // Fetch agents from our API (which calls openclaw CLI)
    const res = await fetch("http://localhost:3000/api/agents", {
      cache: "no-store", // Always get fresh data
    });

    if (!res.ok) {
      throw new Error("Failed to fetch agents");
    }

    const data = await res.json();
    return data.agents || [];
  } catch (error) {
    console.error("Failed to load agents:", error);
    // Return empty array on error
    return [];
  }
}

export default async function Home() {
  const agents = await getAgents();

  return <DashboardView agents={agents} />;
}
