import { NextResponse } from "next/server";
import { callGatewayRpc } from "@/src/lib/openclawGateway";
import {
  gatewayEntryToAgent,
  type AgentAddParams,
  type AgentsListResponse,
  type GatewayAgentEntry,
  type GatewayAgentsCreateParams,
  type GatewayAgentsCreateResult,
} from "@/src/types/agent";

export const runtime = "nodejs";

/** Response from agents.files.get RPC */
interface AgentFileGetResponse {
  agentId: string;
  workspace: string;
  file: {
    name: string;
    path: string;
    missing: boolean;
    size?: number;
    content?: string;
  };
}

/** Fetch a workspace file via Gateway RPC, return undefined on failure */
async function getAgentFile(agentId: string, name: string): Promise<string | undefined> {
  try {
    const res = await callGatewayRpc<AgentFileGetResponse>("agents.files.get", { agentId, name });
    if (res.file?.missing) return undefined;
    return res.file?.content;
  } catch {
    return undefined;
  }
}

/** Enrich a GatewayAgentEntry with SOUL.md and MEMORY.md via Gateway RPC */
async function enrichWithWorkspaceFiles(entry: GatewayAgentEntry): Promise<GatewayAgentEntry> {
  const [soulMd, memoryMd] = await Promise.all([
    getAgentFile(entry.id, "SOUL.md"),
    getAgentFile(entry.id, "MEMORY.md"),
  ]);
  return { ...entry, soulMd, memoryMd };
}

// ──────────────────────────────────────────────
// GET /api/agents → agents.list via Gateway RPC
// ──────────────────────────────────────────────

export async function GET() {
  try {
    const result = await callGatewayRpc<AgentsListResponse>("agents.list");

    // OpenClaw may return agents under "agents" or "list" key
    const rawAgents: GatewayAgentEntry[] = result.agents ?? result.list ?? [];

    const enriched = await Promise.all(rawAgents.map(enrichWithWorkspaceFiles));
    const agents = enriched.map(gatewayEntryToAgent);

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
// POST /api/agents → agents.create via Gateway RPC
// ──────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AgentAddParams;

    // The Gateway derives the agent id from the name, so the name is what
    // actually has to be present. Fall back to a caller-supplied id.
    const name = body.name?.trim() || body.id?.trim();
    if (!name) {
      return NextResponse.json(
        { error: "Agent name is required" },
        { status: 400 },
      );
    }

    const workspace =
      body.workspace?.trim() || `~/.openclaw/workspace-${body.id?.trim() || name}`;

    // agents.create validates with additionalProperties: false — only the
    // fields below may be sent, and identity is flattened to emoji/avatar.
    const params: GatewayAgentsCreateParams = { name, workspace };
    if (body.model) params.model = body.model;
    if (body.identity?.emoji) params.emoji = body.identity.emoji;
    if (body.identity?.avatar) params.avatar = body.identity.avatar;

    const result = await callGatewayRpc<GatewayAgentsCreateResult>(
      "agents.create",
      params,
    );

    return NextResponse.json({
      success: true,
      // Report the id the Gateway actually assigned — it normalizes the name
      // and may differ from anything the caller suggested.
      agent: {
        id: result.agentId,
        name: result.name,
        workspace: result.workspace,
        model: result.model,
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
