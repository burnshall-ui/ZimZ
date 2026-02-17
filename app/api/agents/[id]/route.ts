import { NextResponse } from "next/server";
import { callGatewayRpc } from "@/src/lib/openclawGateway";
import type {
  AgentDeleteParams,
  AgentUpdateParams,
  AgentsListResponse,
  GatewayAgentEntry,
} from "@/src/types/agent";

interface ParamsContext {
  params: Promise<{ id: string }>;
}

export const runtime = "nodejs";

// ──────────────────────────────────────────────
// DELETE /api/agents/[id] → agents.delete via Gateway RPC
// ──────────────────────────────────────────────

export async function DELETE(_request: Request, context: ParamsContext) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "Agent ID is required" },
        { status: 400 },
      );
    }

    await callGatewayRpc<unknown>("agents.delete", {
      id,
      force: true,
    } satisfies AgentDeleteParams);

    return NextResponse.json({
      success: true,
      deletedAgentId: id,
    });
  } catch (error) {
    console.error("[/api/agents/[id] DELETE] Gateway RPC failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete agent",
      },
      { status: 500 },
    );
  }
}

// ──────────────────────────────────────────────
// GET /api/agents/[id] → find agent from agents.list
// ──────────────────────────────────────────────

export async function GET(_request: Request, context: ParamsContext) {
  try {
    const { id } = await context.params;

    const result = await callGatewayRpc<AgentsListResponse>("agents.list");
    const rawAgents: GatewayAgentEntry[] = result.agents ?? result.list ?? [];
    const agent = rawAgents.find((a) => a.id === id);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json({ agent });
  } catch (error) {
    console.error("[/api/agents/[id] GET] Gateway RPC failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get agent",
      },
      { status: 500 },
    );
  }
}

// ──────────────────────────────────────────────
// PATCH /api/agents/[id] → agents.update via Gateway RPC
// Used for model assignment and identity updates
// ──────────────────────────────────────────────

export async function PATCH(request: Request, context: ParamsContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Partial<AgentUpdateParams>;

    await callGatewayRpc<unknown>("agents.update", {
      id,
      ...body,
    });

    return NextResponse.json({ ok: true, agentId: id });
  } catch (error) {
    console.error("[/api/agents/[id] PATCH] Gateway RPC failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update agent",
      },
      { status: 500 },
    );
  }
}
