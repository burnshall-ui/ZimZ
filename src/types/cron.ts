export type OpenClawSessionTarget = "main" | "isolated";
export type OpenClawWakeMode = "now" | "next-heartbeat";
export type OpenClawDeliveryMode = "announce" | "none";
export type OpenClawDeliveryChannel =
  | "last"
  | "whatsapp"
  | "telegram"
  | "discord"
  | "slack"
  | "mattermost"
  | "signal"
  | "imessage";

export interface OpenClawCronScheduleCron {
  kind: "cron";
  expr: string;
  tz?: string;
}

export interface OpenClawCronScheduleAt {
  kind: "at";
  at: string;
}

export interface OpenClawCronScheduleEvery {
  kind: "every";
  everyMs: number;
}

export type OpenClawCronSchedule =
  | OpenClawCronScheduleCron
  | OpenClawCronScheduleAt
  | OpenClawCronScheduleEvery;

export interface OpenClawSystemEventPayload {
  kind: "systemEvent";
  text: string;
}

export interface OpenClawAgentTurnPayload {
  kind: "agentTurn";
  message: string;
  model?: string;
  thinking?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  timeoutSeconds?: number;
}

export type OpenClawCronPayload =
  | OpenClawSystemEventPayload
  | OpenClawAgentTurnPayload;

export interface OpenClawDelivery {
  mode: OpenClawDeliveryMode;
  channel?: OpenClawDeliveryChannel;
  to?: string;
  bestEffort?: boolean;
}

export interface OpenClawCronAddParams {
  name: string;
  schedule: OpenClawCronSchedule;
  sessionTarget: OpenClawSessionTarget;
  wakeMode?: OpenClawWakeMode;
  payload: OpenClawCronPayload;
  agentId?: string;
  description?: string;
  enabled?: boolean;
  deleteAfterRun?: boolean;
  delivery?: OpenClawDelivery;
}

export interface OpenClawCronUpdateParams {
  jobId: string;
  patch: Partial<OpenClawCronAddParams> & { agentId?: string | null };
}
