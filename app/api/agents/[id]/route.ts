import { NextResponse } from "next/server";
import { gatewayRpc } from "@/src/lib/openclawGateway";
import type {
  AgentUpdateParams,
  AgentsListResponse,
  GatewayAgentEntry,
  GatewayAgentsDeleteParams,
  GatewayAgentsUpdateParams,
} from "@/src/types/agent";

/** Body accepted by PATCH — Gateway fields plus the two workspace files. */
type AgentPatchBody = Partial<AgentUpdateParams> & {
  soulMd?: string;
  memoryMd?: string;
};

interface ParamsContext {
  params: Promise<{ id: string }>;
}

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
    const res = await gatewayRpc<AgentFileGetResponse>("agents.files.get", { agentId, name });
    if (res.file?.missing) return undefined;
    return res.file?.content;
  } catch {
    return undefined;
  }
}

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

    // The Gateway keys agents by `agentId` and gates file removal behind
    // `deleteFiles`. Leaving that off keeps the workspace on disk, so a
    // mistaken delete stays recoverable.
    await gatewayRpc<unknown>("agents.delete", {
      agentId: id,
    } satisfies GatewayAgentsDeleteParams);

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

    const result = await gatewayRpc<AgentsListResponse>("agents.list");
    const rawAgents: GatewayAgentEntry[] = result.agents ?? result.list ?? [];
    const agent = rawAgents.find((a) => a.id === id);

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Enrich with workspace files via Gateway RPC
    const [soulMd, memoryMd] = await Promise.all([
      getAgentFile(id, "SOUL.md"),
      getAgentFile(id, "MEMORY.md"),
    ]);
    if (soulMd !== undefined) agent.soulMd = soulMd;
    if (memoryMd !== undefined) agent.memoryMd = memoryMd;

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
// Used for model assignment, identity updates, and workspace file writes
// ──────────────────────────────────────────────

export async function PATCH(request: Request, context: ParamsContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as AgentPatchBody;

    const { soulMd, memoryMd } = body;

    // Allowlist the fields forwarded to agents.update. The agent id comes from
    // the path, never the body, and the Gateway rejects unknown properties, so
    // identity is flattened to the emoji/avatar fields it accepts.
    const rpcParams: Omit<GatewayAgentsUpdateParams, "agentId"> = {};
    if (body.model !== undefined) rpcParams.model = body.model;
    if (body.name !== undefined) rpcParams.name = body.name;
    if (body.identity?.emoji !== undefined) rpcParams.emoji = body.identity.emoji;
    if (body.identity?.avatar !== undefined) rpcParams.avatar = body.identity.avatar;

    // Write workspace files via Gateway RPC
    const fileWrites: Promise<unknown>[] = [];
    if (soulMd !== undefined) {
      fileWrites.push(
        gatewayRpc("agents.files.set", { agentId: id, name: "SOUL.md", content: soulMd }),
      );
    }
    if (memoryMd !== undefined) {
      fileWrites.push(
        gatewayRpc("agents.files.set", { agentId: id, name: "MEMORY.md", content: memoryMd }),
      );
    }
    if (fileWrites.length > 0) {
      await Promise.all(fileWrites);
    }

    // Forward other fields to Gateway RPC if present
    const hasRpcFields = Object.keys(rpcParams).length > 0;
    if (hasRpcFields) {
      await gatewayRpc<unknown>("agents.update", {
        agentId: id,
        ...rpcParams,
      } satisfies GatewayAgentsUpdateParams);
    }

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
