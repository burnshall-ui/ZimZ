import DashboardView from "@/src/components/DashboardView";

export default function Home() {
  const agents = [{
    id: "alex-summarizer",
    name: "Alex 👾",
    status: "idle" as const,
    currentTask: "ZimZ Dashboard live – Tasks real!",
    modelType: "openrouter/x-ai/grok-4.1-fast",
    logs: ["Gateway Cron: Daily Report loaded", "Real data sync OK"],
    soulMd: "# Alex\n\nProaktiv, kurz, CNC/EVE-Fokus. Berlin TZ.",
    memoryMd: "# Memory\n\nUser workspace context loaded."
  }];

  return <DashboardView agents={agents} />;
}
