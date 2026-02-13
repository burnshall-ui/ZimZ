// Extended status types for OfficeMap zone mapping:
// working -> Dev Lab | collaborating -> Meeting Room | idle/waiting -> Lounge
export type AgentStatus = "working" | "collaborating" | "idle" | "waiting";

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  currentTask: string;
  modelType: string;
  logs: string[];

  // OpenClaw workspace files (editable in the Settings tab)
  soulMd: string;
  memoryMd: string;
}
