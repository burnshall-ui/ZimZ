"use client";

import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { Code2, Coffee, Users } from "lucide-react";
import { useState } from "react";
import AgentBubble from "@/src/components/AgentBubble";
import type { Agent, AgentStatus } from "@/src/types/agent";

// ──────────────────────────────────────────────
// Types & helpers
// ──────────────────────────────────────────────

type ZoneId = "meeting" | "devlab" | "lounge";

/** Extract up to 2 initials from the agent name (e.g. "Sentinel-Core" -> "SC") */
function getInitials(name: string): string {
  return name
    .split(/[-\s]/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

/** Map agent status to a zone on the map */
function getZone(status: AgentStatus): ZoneId {
  switch (status) {
    case "collaborating":
      return "meeting";
    case "working":
      return "devlab";
    case "idle":
    case "waiting":
    default:
      return "lounge";
  }
}

// ──────────────────────────────────────────────
// Style configurations
// ──────────────────────────────────────────────

/** Avatar styles per status: border, background and glow effect */
const avatarStyles: Record<
  AgentStatus,
  { border: string; bg: string; glow: string }
> = {
  working: {
    border: "border-emerald-400",
    bg: "bg-emerald-500/20",
    glow: "shadow-[0_0_14px_rgba(16,185,129,0.45)]",
  },
  collaborating: {
    border: "border-violet-400",
    bg: "bg-violet-500/20",
    glow: "shadow-[0_0_14px_rgba(139,92,246,0.45)]",
  },
  idle: {
    border: "border-slate-500",
    bg: "bg-slate-500/15",
    glow: "shadow-[0_0_10px_rgba(148,163,184,0.25)]",
  },
  waiting: {
    border: "border-amber-400",
    bg: "bg-amber-500/20",
    glow: "shadow-[0_0_14px_rgba(245,158,11,0.4)]",
  },
};

/** Configuration for each of the 3 zones */
interface ZoneConfig {
  id: ZoneId;
  label: string;
  icon: React.ReactNode;
  borderColor: string;
  cornerColor: string;
  glowBg: string;
}

const zoneConfigs: ZoneConfig[] = [
  {
    id: "meeting",
    label: "Meeting Room",
    icon: <Users className="h-4 w-4 text-violet-400" />,
    borderColor: "border-violet-500/25",
    cornerColor: "border-violet-400/40",
    glowBg: "bg-violet-500",
  },
  {
    id: "devlab",
    label: "Dev Lab",
    icon: <Code2 className="h-4 w-4 text-emerald-400" />,
    borderColor: "border-emerald-500/25",
    cornerColor: "border-emerald-400/40",
    glowBg: "bg-emerald-500",
  },
  {
    id: "lounge",
    label: "Lounge",
    icon: <Coffee className="h-4 w-4 text-amber-400" />,
    borderColor: "border-amber-500/25",
    cornerColor: "border-amber-400/40",
    glowBg: "bg-amber-500",
  },
];

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

/** Futuristic corner decorations for zones (sci-fi bracket effect) */
function ZoneCorners({ color }: { color: string }) {
  return (
    <>
      <span
        className={`absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 ${color}`}
      />
      <span
        className={`absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 ${color}`}
      />
      <span
        className={`absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 ${color}`}
      />
      <span
        className={`absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 ${color}`}
      />
    </>
  );
}

/**
 * Round avatar for an agent with integrated bubble.
 * layoutId ensures framer-motion animates the avatar
 * when it changes zone through a status change.
 */
function AgentAvatar({
  agent,
  isSelected,
  onToggle,
  onClose,
  onDelete,
}: {
  agent: Agent;
  isSelected: boolean;
  onToggle: () => void;
  onClose: () => void;
  onDelete?: (agentId: string) => void;
}) {
  const style = avatarStyles[agent.status];

  return (
    <div className="relative overflow-visible">
      <motion.button
        layoutId={`avatar-${agent.id}`}
        onClick={onToggle}
        className="group flex flex-col items-center gap-1.5"
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full border-2 ${style.border} ${style.bg} ${style.glow} transition-all ${
            isSelected ? "ring-2 ring-cyan-400/50 ring-offset-2 ring-offset-slate-950" : ""
          }`}
        >
          <span className="text-sm font-bold text-white">
            {getInitials(agent.name)}
          </span>
        </div>
        <span className="max-w-[72px] truncate text-[10px] text-slate-500 transition-colors group-hover:text-slate-200">
          {agent.name}
        </span>
      </motion.button>

      {/* Bubble appears directly below the avatar */}
      <AnimatePresence>
        {isSelected && (
          <AgentBubble
            key={`bubble-${agent.id}`}
            agent={agent}
            onClose={onClose}
            onDelete={onDelete}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** A single zone on the floor plan (Meeting Room, Dev Lab or Lounge) */
function ZonePanel({
  config,
  agents,
  selectedAgentId,
  onToggleAgent,
  onCloseAgent,
  onDeleteAgent,
}: {
  config: ZoneConfig;
  agents: Agent[];
  selectedAgentId: string | null;
  onToggleAgent: (agentId: string) => void;
  onCloseAgent: () => void;
  onDeleteAgent?: (agentId: string) => void;
}) {
  return (
    <div
      className={`relative overflow-visible rounded-xl border ${config.borderColor} bg-slate-950/60 p-5`}
    >
      {/* Subtle colored background glow */}
      <div
        className={`pointer-events-none absolute inset-0 rounded-xl ${config.glowBg} opacity-[0.03]`}
      />

      {/* Futuristic corner decorations */}
      <ZoneCorners color={config.cornerColor} />

      {/* Zone label with icon and agent counter */}
      <div className="relative mb-4 flex items-center gap-2">
        {config.icon}
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          {config.label}
        </span>
        <span className="ml-auto rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] tabular-nums text-slate-500">
          {agents.length}
        </span>
      </div>

      {/* Agent avatars within the zone */}
      <div className="relative flex min-h-[72px] flex-wrap items-start gap-5">
        {agents.length === 0 && (
          <p className="text-xs italic text-slate-700">No agents here</p>
        )}
        {agents.map((agent) => (
          <AgentAvatar
            key={agent.id}
            agent={agent}
            isSelected={selectedAgentId === agent.id}
            onToggle={() => onToggleAgent(agent.id)}
            onClose={onCloseAgent}
            onDelete={onDeleteAgent}
          />
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────

interface OfficeMapProps {
  agents: Agent[];
  onDeleteAgent?: (agentId: string) => void;
}

export default function OfficeMap({ agents, onDeleteAgent }: OfficeMapProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const handleToggle = (agentId: string) => {
    setSelectedAgentId((current) => (current === agentId ? null : agentId));
  };

  const handleClose = () => setSelectedAgentId(null);

  // Group agents by zone based on their status
  const grouped: Record<ZoneId, Agent[]> = {
    meeting: agents.filter((a) => getZone(a.status) === "meeting"),
    devlab: agents.filter((a) => getZone(a.status) === "devlab"),
    lounge: agents.filter((a) => getZone(a.status) === "lounge"),
  };

  const meetingCfg = zoneConfigs.find((z) => z.id === "meeting")!;
  const devlabCfg = zoneConfigs.find((z) => z.id === "devlab")!;
  const loungeCfg = zoneConfigs.find((z) => z.id === "lounge")!;

  return (
    <LayoutGroup>
      {/* Floor plan layout: Meeting Room on top, Dev Lab + Lounge below */}
      <div className="grid min-h-[420px] grid-rows-2 gap-3">
        {/* Meeting Room - full width on top */}
        <ZonePanel
          config={meetingCfg}
          agents={grouped.meeting}
          selectedAgentId={selectedAgentId}
          onToggleAgent={handleToggle}
          onCloseAgent={handleClose}
          onDeleteAgent={onDeleteAgent}
        />

        {/* Bottom row: Dev Lab left, Lounge right */}
        <div className="grid grid-cols-2 gap-3">
          <ZonePanel
            config={devlabCfg}
            agents={grouped.devlab}
            selectedAgentId={selectedAgentId}
            onToggleAgent={handleToggle}
            onCloseAgent={handleClose}
            onDeleteAgent={onDeleteAgent}
          />
          <ZonePanel
            config={loungeCfg}
            agents={grouped.lounge}
            selectedAgentId={selectedAgentId}
            onToggleAgent={handleToggle}
            onCloseAgent={handleClose}
            onDeleteAgent={onDeleteAgent}
          />
        </div>
      </div>
    </LayoutGroup>
  );
}
