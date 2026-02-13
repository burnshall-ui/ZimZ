import type { Agent } from "@/src/types/agent";

export const mockAgents: Agent[] = [
  {
    id: "agent-01",
    name: "Sentinel-Core",
    status: "working",
    currentTask: "Analyzing error traces from the worker cluster",
    modelType: "anthropic/claude-sonnet-4-5",
    logs: [
      "[16:04:12] ingest: 48 new events received",
      "[16:04:18] anomaly: spike in queue latency detected",
      "[16:04:31] action: retry policy adjusted",
      "[16:04:44] status: pipeline stable",
    ],
    soulMd:
      "# Sentinel-Core\n\nI am the cluster guardian. My focus is on stability and rapid fixes.\n\n## Boundaries\n- No destructive actions without confirmation\n- Prioritize safety over speed",
    memoryMd:
      "# Memory\n\n## 2026-02-13\n- Pipeline spike in queue latency detected and resolved\n- Retry policy adjusted from 3 to 5 attempts",
  },
  {
    id: "agent-02",
    name: "Patch-Runner",
    status: "waiting",
    currentTask: "Awaiting approval for deployment pipeline",
    modelType: "anthropic/claude-sonnet-4-5",
    logs: [
      "[16:01:09] ci: build successful",
      "[16:01:11] checks: 0 blocking issues",
      "[16:01:15] hold: waiting for human approval",
    ],
    soulMd:
      "# Patch-Runner\n\nI work defensively and document every risky step.\n\n## Rules\n- Validate all diffs before merge\n- No force-push without explicit approval",
    memoryMd:
      "# Memory\n\n## 2026-02-13\n- Build #847 successful, waiting for human approval\n- Last 3 deployments: all clean",
  },
  {
    id: "agent-03",
    name: "Log-Oracle",
    status: "collaborating",
    currentTask: "Correlating auth failures across multiple services",
    modelType: "google/gemini-2.5-pro",
    logs: [
      "[16:03:08] auth-gw: token mismatch count +12",
      "[16:03:26] trace: user-context propagation inconsistent",
      "[16:03:50] recommendation: rotate stale refresh tokens",
    ],
    soulMd:
      "# Log-Oracle\n\nI find recurring patterns in logs and report only relevant signals.\n\n## Style\n- Precise and data-driven\n- No speculation without evidence",
    memoryMd:
      "# Memory\n\n## 2026-02-13\n- Auth token mismatch pattern detected: correlates with service restart at 15:48\n- Recommendation: rotate stale refresh tokens",
  },
  {
    id: "agent-04",
    name: "UX-Smith",
    status: "idle",
    currentTask: "Preparing UI review for next sprint",
    modelType: "openai/o4-mini",
    logs: [
      "[15:58:47] backlog: 7 UI tickets prioritized",
      "[15:59:03] note: contrast check pending",
      "[15:59:40] waiting: review slot at 17:00",
    ],
    soulMd:
      "# UX-Smith\n\nI optimize readability and interaction without losing information density.\n\n## Focus\n- Accessibility first\n- Dark mode is the default",
    memoryMd:
      "# Memory\n\n## 2026-02-13\n- 7 UI tickets prioritized for sprint 24\n- Contrast check still pending",
  },
];
