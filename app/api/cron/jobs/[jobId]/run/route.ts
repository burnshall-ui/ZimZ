import { NextResponse } from "next/server";
import { callGatewayRpc } from "@/src/lib/openclawGateway";

interface ParamsContext {
  params: Promise<{ jobId: string }>;
}

export const runtime = "nodejs";

export async function POST(_: Request, context: ParamsContext) {
  try {
    const { jobId } = await context.params;
    await callGatewayRpc("cron.run", { jobId, mode: "force" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run cron job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
