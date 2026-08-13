import { NextResponse } from "next/server";
import { gatewayRpc } from "@/src/lib/openclawGateway";
import type { OpenClawCronUpdateParams } from "@/src/types/cron";

interface ParamsContext {
  params: Promise<{ jobId: string }>;
}

export const runtime = "nodejs";

export async function PATCH(request: Request, context: ParamsContext) {
  try {
    const { jobId } = await context.params;
    const body = (await request.json()) as OpenClawCronUpdateParams["patch"];
    await gatewayRpc("cron.update", { jobId, patch: body });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update cron job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: ParamsContext) {
  try {
    const { jobId } = await context.params;
    await gatewayRpc("cron.remove", { jobId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete cron job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
