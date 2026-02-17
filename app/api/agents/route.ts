import { NextResponse } from "next/server";
import { callGatewayRpc } from "@/src/lib/openclawGateway";
import {
  gatewayEntryToAgent,
  type AgentAddParams,
  type AgentsListResponse,
  type GatewayAgentEntry,
} from "@/src/types/agent";

export const runtime = "nodejs";

// ──────────────────────────────────────────────
// GET /api/agents → agents.list via Gateway RPC
// ──────────────────────────────────────────────

export async function GET() {
  try {
    const result = await callGatewayRpc<AgentsListResponse>("agents.list");

    // OpenClaw may return agents under "agents" or "list" key
    const rawAgents: GatewayAgentEntry[] = result.agents ?? result.list ?? [];

    const agents = rawAgents.map(gatewayEntryToAgent);

    return NextResponse.json({ agents, source: "gateway" });
  } catch (error) {
    console.error("[/api/agents GET] Gateway RPC failed:", error);

    // Return error with empty agents so the UI still renders
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list agents",
        agents: [],
        source: "error",
      },
      { status: 200 }, // 200 so frontend doesn't break
    );
  }
}

// ──────────────────────────────────────────────
// POST /api/agents → agents.add via Gateway RPC
// ──────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AgentAddParams;

    if (!body.id) {
      return NextResponse.json(
        { error: "Agent ID is required" },
        { status: 400 },
      );
    }

    // Build workspace path if not provided
    const workspace =
      body.workspace || `~/.openclaw/workspace-${body.id}`;

    // Call Gateway RPC to add the agent
    const result = await callGatewayRpc<{ agent?: GatewayAgentEntry }>(
      "agents.add",
      {
        id: body.id,
        name: body.name ?? body.id,
        workspace,
        model: body.model,
        identity: body.identity ?? { name: body.name ?? body.id },
      },
    );

    return NextResponse.json({
      success: true,
      agent: result.agent ?? {
        id: body.id,
        name: body.name ?? body.id,
        workspace,
        model: body.model,
      },
    });
  } catch (error) {
    console.error("[/api/agents POST] Gateway RPC failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to add agent",
      },
      { status: 500 },
    );
  }
}
