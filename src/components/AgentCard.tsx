import { Bot, CircleDot } from "lucide-react";
import type { Agent, AgentStatus } from "@/src/types/agent";

// Colors and labels for each of the 4 status types
const statusConfig: Record<AgentStatus, { color: string; label: string }> = {
  working: {
    color: "text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.55)]",
    label: "Working",
  },
  collaborating: {
    color: "text-violet-400 drop-shadow-[0_0_6px_rgba(139,92,246,0.55)]",
    label: "Collaborating",
  },
  idle: {
    color: "text-slate-400 drop-shadow-[0_0_6px_rgba(148,163,184,0.35)]",
    label: "Idle",
  },
  waiting: {
    color: "text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.45)]",
    label: "Waiting",
  },
};

interface AgentCardProps {
  agent: Agent;
  isSelected: boolean;
  onClick: () => void;
}

export default function AgentCard({
  agent,
  isSelected,
  onClick,
}: AgentCardProps) {
  const { color: statusColor, label: statusLabel } = statusConfig[agent.status];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full rounded-2xl border p-5 text-left transition-all duration-250 ${
        isSelected
          ? "border-cyan-300/70 bg-slate-900/95 shadow-[0_0_35px_rgba(34,211,238,0.25)]"
          : "border-slate-700/90 bg-slate-900/70 hover:border-cyan-400/50 hover:bg-slate-900/90"
      }`}
      aria-label={`${agent.name} details`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-cyan-300" />
          <h3 className="text-base font-semibold tracking-wide text-slate-100">
            {agent.name}
          </h3>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs">
          <CircleDot className={`h-3.5 w-3.5 ${statusColor}`} />
          <span className="text-slate-300">{statusLabel}</span>
        </div>
      </div>

      <p className="mb-4 line-clamp-2 min-h-10 text-sm text-slate-400">
        {agent.currentTask}
      </p>

      <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-xs">
        <span className="text-slate-500">Model</span>
        <span className="font-mono text-cyan-200/90">{agent.modelType}</span>
      </div>

      <span className="pointer-events-none absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </button>
  );
}
