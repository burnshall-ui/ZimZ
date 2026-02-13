import { NextResponse } from "next/server";
import { callGatewayRpc } from "@/src/lib/openclawGateway";
import type { OpenClawCronAddParams } from "@/src/types/cron";

interface CronListResult {
  jobs?: unknown[];
}

interface CronAddResult {
  job?: unknown;
  jobId?: string;
}

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await callGatewayRpc<CronListResult>("cron.list");
    return NextResponse.json({ jobs: result.jobs ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load cron jobs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OpenClawCronAddParams;
    const result = await callGatewayRpc<CronAddResult>("cron.add", body);
    return NextResponse.json({
      job: result.job ?? null,
      jobId: result.jobId ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create cron job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
