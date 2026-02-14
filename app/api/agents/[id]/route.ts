import { NextResponse } from "next/server";
import { callGatewayRpc } from "@/src/lib/openclawGateway";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Call OpenClaw Gateway to delete agent
    await callGatewayRpc("agents.delete", { id });

    return NextResponse.json({
      success: true,
      deletedAgentId: id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete agent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
