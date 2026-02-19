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

interface MotionPreset {
  layoutTransition: {
    type: "spring";
    stiffness: number;
    damping: number;
    mass: number;
  };
  spawnDuration: number;
  hoverScale: number;
  tapScale: number;
  pulseDuration: number;
  pulseScale: number;
}

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
  pulseColor: string;
}

const zoneConfigs: ZoneConfig[] = [
  {
    id: "meeting",
    label: "Meeting Room",
    icon: <Users className="h-4 w-4 text-violet-400" />,
    borderColor: "border-violet-500/25",
    cornerColor: "border-violet-400/40",
    glowBg: "bg-violet-500",
    pulseColor: "rgba(139, 92, 246, 0.42)",
  },
  {
    id: "devlab",
    label: "Dev Lab",
    icon: <Code2 className="h-4 w-4 text-emerald-400" />,
    borderColor: "border-emerald-500/25",
    cornerColor: "border-emerald-400/40",
    glowBg: "bg-emerald-500",
    pulseColor: "rgba(16, 185, 129, 0.42)",
  },
  {
    id: "lounge",
    label: "Lounge",
    icon: <Coffee className="h-4 w-4 text-amber-400" />,
    borderColor: "border-amber-500/25",
    cornerColor: "border-amber-400/40",
    glowBg: "bg-amber-500",
    pulseColor: "rgba(245, 158, 11, 0.38)",
  },
];

const cleanProPreset: MotionPreset = {
  layoutTransition: { type: "spring", stiffness: 320, damping: 30, mass: 0.9 },
  spawnDuration: 0.18,
  hoverScale: 1.04,
  tapScale: 0.98,
  pulseDuration: 0.22,
  pulseScale: 1.015,
};

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
  preset,
  transitionKey,
  isSelected,
  onToggle,
  onClose,
  onDelete,
  onSave,
}: {
  agent: Agent;
  preset: MotionPreset;
  transitionKey: string;
  isSelected: boolean;
  onToggle: () => void;
  onClose: () => void;
  onDelete?: (agentId: string) => void;
  onSave?: (agentId: string, updates: { soulMd?: string; memoryMd?: string }) => void;
}) {
  const style = avatarStyles[agent.status];

  return (
    <motion.div layout className="relative overflow-visible">
      <motion.button
        layout
        layoutId={`agent-avatar-${agent.id}`}
        initial={{ opacity: 0, scale: 0, filter: "blur(6px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 0, filter: "blur(6px)" }}
        transition={{
          opacity: { duration: preset.spawnDuration, ease: "easeOut" },
          filter: { duration: preset.spawnDuration, ease: "easeOut" },
          scale: {
            type: "spring",
            stiffness: 360,
            damping: 22,
            mass: 0.65,
          },
          layout: preset.layoutTransition,
        }}
        onClick={onToggle}
        className="group flex flex-col items-center gap-1.5"
        whileHover={{ scale: preset.hoverScale }}
        whileTap={{ scale: preset.tapScale }}
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
            onSave={onSave}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** A single zone on the floor plan (Meeting Room, Dev Lab or Lounge) */
function ZonePanel({
  config,
  agents,
  preset,
  selectedAgentId,
  onToggleAgent,
  onCloseAgent,
  onDeleteAgent,
  onSaveAgent,
  className,
}: {
  config: ZoneConfig;
  agents: Agent[];
  preset: MotionPreset;
  selectedAgentId: string | null;
  onToggleAgent: (agentId: string) => void;
  onCloseAgent: () => void;
  onDeleteAgent?: (agentId: string) => void;
  onSaveAgent?: (agentId: string, updates: { soulMd?: string; memoryMd?: string }) => void;
  className?: string;
}) {
  const occupancyKey = agents
    .map((agent) => `${agent.id}:${agent.status}`)
    .sort()
    .join("|");

  return (
    <div
      className={`relative overflow-visible rounded-xl border ${config.borderColor} bg-slate-950/60 p-4 sm:p-5 ${className ?? ""}`}
    >
      {/* Subtle colored background glow */}
      <div
        className={`pointer-events-none absolute inset-0 rounded-xl ${config.glowBg} opacity-[0.03]`}
      />
      <AnimatePresence initial={false}>
          <motion.span
            key={`zone-pulse-${config.id}-${occupancyKey}`}
            initial={{ opacity: 0.22, scale: 0.99 }}
            animate={{ opacity: 0, scale: preset.pulseScale }}
            exit={{ opacity: 0 }}
            transition={{ duration: preset.pulseDuration, ease: "easeOut" }}
            style={{ backgroundColor: config.pulseColor }}
            className="pointer-events-none absolute inset-1 rounded-[10px] blur-sm"
          />
      </AnimatePresence>

      {/* Futuristic corner decorations */}
      <ZoneCorners color={config.cornerColor} />

      {/* Zone label with icon and agent counter */}
      <div className="relative mb-4 flex items-center gap-2">
        {config.icon}
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          {config.label}
        </span>
        <motion.span
          key={`${config.id}-${agents.length}-${occupancyKey}`}
          initial={{ opacity: 0.65, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 460, damping: 24 }}
          className="ml-auto rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] tabular-nums text-slate-500"
        >
          {agents.length}
        </motion.span>
      </div>

      {/* Agent avatars within the zone */}
      <div className="relative flex min-h-[72px] flex-wrap items-start gap-5">
        {agents.length === 0 && (
          <p className="text-xs italic text-slate-700">No agents here</p>
        )}
        <AnimatePresence mode="popLayout">
          {agents.map((agent) => (
            <AgentAvatar
              key={agent.id}
              agent={agent}
              preset={preset}
              transitionKey={agent.status}
              isSelected={selectedAgentId === agent.id}
              onToggle={() => onToggleAgent(agent.id)}
              onClose={onCloseAgent}
              onDelete={onDeleteAgent}
              onSave={onSaveAgent}
            />
          ))}
        </AnimatePresence>
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
  onSaveAgent?: (agentId: string, updates: { soulMd?: string; memoryMd?: string }) => void;
}

export default function OfficeMap({ agents, onDeleteAgent, onSaveAgent }: OfficeMapProps) {
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
    <LayoutGroup id="office-map-layout">
      {/* Floor plan layout:
          - Mobile: stacked zones for better readability
          - Desktop: Dev Lab on top, Meeting Room + Lounge below */}
      <div className="grid gap-3 md:min-h-[420px] md:grid-rows-2">
        {/* Dev Lab - full width on top */}
        <ZonePanel
          config={devlabCfg}
          agents={grouped.devlab}
          preset={cleanProPreset}
          selectedAgentId={selectedAgentId}
          onToggleAgent={handleToggle}
          onCloseAgent={handleClose}
          onDeleteAgent={onDeleteAgent}
          onSaveAgent={onSaveAgent}
        />

        {/* Bottom row (desktop): Meeting Room left, Lounge right */}
        <div className="grid gap-3 md:grid-cols-2 md:items-start">
          <ZonePanel
            config={meetingCfg}
            agents={grouped.meeting}
            preset={cleanProPreset}
            selectedAgentId={selectedAgentId}
            onToggleAgent={handleToggle}
            onCloseAgent={handleClose}
            onDeleteAgent={onDeleteAgent}
            onSaveAgent={onSaveAgent}
            className="md:self-start"
          />
          <ZonePanel
            config={loungeCfg}
            agents={grouped.lounge}
            preset={cleanProPreset}
            selectedAgentId={selectedAgentId}
            onToggleAgent={handleToggle}
            onCloseAgent={handleClose}
            onDeleteAgent={onDeleteAgent}
            onSaveAgent={onSaveAgent}
          />
        </div>
      </div>
    </LayoutGroup>
  );
}
