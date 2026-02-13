import { NextResponse } from "next/server";
import { callGatewayRpc } from "@/src/lib/openclawGateway";
import type { Agent } from "@/src/types/agent";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Fetch real agents from OpenClaw
    const configResult = await callGatewayRpc<any>("config.get");
    const config = configResult.result?.parsed || configResult.result || configResult;

    let agents: Agent[] = [];
    if (config?.agents?.list) {
      agents = config.agents.list.map((a: any) => ({
        id: a.id,
        name: a.name || a.id,
        status: "idle" as const,
        currentTask: "Bereit",
        modelType: a.model || "Grok Fast",
        logs: [],
        soulMd: `# ${a.name || a.id}\n\nReal OpenClaw Agent.`,
        memoryMd: "# Memory\n\nAus Config geladen."
      }));
    }

    if (agents.length === 0) {
      // Fallback to known agent
      agents = [{
        id: "alex-summarizer",
        name: "Alex 👾",
        status: "idle" as const,
        currentTask: "Warte auf Tasks",
        modelType: "openrouter/x-ai/grok-4.1-fast",
        logs: ["Real ZimZ!"],
        soulMd: "# Alex\n\nKurz & knackig.",
        memoryMd: "# MEMORY\n\nUser Workspace."
      }];
    }

    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Agents fetch failed:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to load agents",
        fallbackAgents: [{
          id: "alex-summarizer",
          name: "Alex (Fallback)",
          status: "idle" as const,
          currentTask: "Gateway Conn Error",
          modelType: "Grok Fast",
          logs: [],
          soulMd: "# Fallback",
          memoryMd: ""
        }]
      }, 
      { status: 500 }
    );
  }
}
