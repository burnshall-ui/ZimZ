"use client";

import { AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import AgentBubble from "@/src/components/AgentBubble";
import AgentCard from "@/src/components/AgentCard";
import type { Agent } from "@/src/types/agent";

interface AgentGridProps {
  agents: Agent[];
  onDeleteAgent?: (agentId: string) => void;
}

export default function AgentGrid({ agents, onDeleteAgent }: AgentGridProps) {
  // Store only the selected ID so exactly one bubble stays open at a time.
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  if (!agents?.length) {
    return (
      <div className="rounded-2xl border border-amber-400/35 bg-amber-500/10 p-5 text-amber-200">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <p className="font-medium">No agents loaded</p>
        </div>
        <p className="text-sm text-amber-100/80">
          Add agents via your gateway/API workflow, or check your data source.
        </p>
      </div>
    );
  }

  const handleCardClick = (agentId: string) => {
    setSelectedAgentId((currentId) => (currentId === agentId ? null : agentId));
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {agents.map((agent) => {
        const isSelected = selectedAgentId === agent.id;

        return (
          <div key={agent.id} className="relative overflow-visible">
            <AgentCard
              agent={agent}
              isSelected={isSelected}
              onClick={() => handleCardClick(agent.id)}
            />

            <AnimatePresence>
              {isSelected ? (
                <AgentBubble
                  key={`bubble-${agent.id}`}
                  agent={agent}
                  onClose={() => setSelectedAgentId(null)}
                  onDelete={onDeleteAgent}
                />
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
