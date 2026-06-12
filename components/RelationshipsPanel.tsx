"use client";

import * as React from "react";
import { ArrowRight, X } from "lucide-react";
import {
  ALL_EDGE_TYPES,
  EDGE_TONES,
  EDGE_TONE_COLORS,
  EDGE_TYPE_LABELS,
  edgeDisplayLabel,
  type EdgeTone,
  type EdgeType,
} from "@/types/graph";
import { useMapStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TONE_LABELS: Record<EdgeTone, string> = {
  risk: "Risk",
  support: "Support",
  data: "Data",
  neutral: "Neutral",
};
const ALL_TONES = Object.keys(TONE_LABELS) as EdgeTone[];

// base-ui Select renders the selected entry from an `items` record via <SelectValue />
const TYPE_ITEMS: Record<string, React.ReactNode> = {
  all: "All types",
  ...Object.fromEntries(ALL_EDGE_TYPES.map((t) => [t, EDGE_TYPE_LABELS[t]])),
};
const TONE_ITEMS: Record<string, React.ReactNode> = {
  all: "All tones",
  ...Object.fromEntries(ALL_TONES.map((t) => [t, TONE_LABELS[t]])),
};

export function RelationshipsPanel() {
  const map = useMapStore((s) => s.map);
  const selectedEdgeId = useMapStore((s) => s.selectedEdgeId);
  const selectEdge = useMapStore((s) => s.selectEdge);
  const setRelationshipsPanelOpen = useMapStore(
    (s) => s.setRelationshipsPanelOpen
  );
  const [typeFilter, setTypeFilter] = React.useState<EdgeType | "all">("all");
  const [toneFilter, setToneFilter] = React.useState<EdgeTone | "all">("all");

  const labelById = React.useMemo(
    () => new Map((map?.nodes ?? []).map((n) => [n.id, n.label])),
    [map]
  );

  const edges = map?.edges ?? [];
  const filtered = edges.filter((e) => {
    if (typeFilter !== "all" && e.type !== typeFilter) return false;
    if (toneFilter !== "all" && EDGE_TONES[e.type] !== toneFilter) return false;
    return true;
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
        <span className="text-[12px] font-medium text-zinc-300">
          Relationships
        </span>
        <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[10.5px] font-semibold text-zinc-400">
          {edges.length}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto text-zinc-400 hover:text-zinc-100"
          onClick={() => setRelationshipsPanelOpen(false)}
          aria-label="Close relationships panel"
        >
          <X />
        </Button>
      </div>

      <div className="flex items-center gap-1.5 border-b border-white/8 px-3 py-2.5">
        <Select
          items={TYPE_ITEMS}
          value={typeFilter}
          onValueChange={(v) => setTypeFilter((v as EdgeType | "all") ?? "all")}
        >
          <SelectTrigger
            size="sm"
            className="flex-1 border-white/10 bg-zinc-900/60 text-[12px]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {ALL_EDGE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {EDGE_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={TONE_ITEMS}
          value={toneFilter}
          onValueChange={(v) => setToneFilter((v as EdgeTone | "all") ?? "all")}
        >
          <SelectTrigger
            size="sm"
            className="w-[7.5rem] border-white/10 bg-zinc-900/60 text-[12px]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tones</SelectItem>
            {ALL_TONES.map((t) => (
              <SelectItem key={t} value={t}>
                {TONE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {edges.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-[12.5px] text-zinc-500">
          No relationships yet. Drag from a node’s lower dot to link two nodes.
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-[12.5px] text-zinc-500">
          No relationships match these filters.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-1.5 py-1.5">
          {filtered.map((edge) => {
            const tone = EDGE_TONES[edge.type];
            const color = EDGE_TONE_COLORS[tone];
            const source = labelById.get(edge.source) ?? "?";
            const target = labelById.get(edge.target) ?? "?";
            return (
              <button
                key={edge.id}
                type="button"
                onClick={() => selectEdge(edge.id, { reveal: true })}
                title={`${source} ${edgeDisplayLabel(edge)} ${target}`}
                className={
                  "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors " +
                  (edge.id === selectedEdgeId ? "bg-white/10" : "hover:bg-white/5")
                }
              >
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="min-w-0 flex-1 text-[12.5px] leading-snug">
                  <span className="text-zinc-200">{source}</span>{" "}
                  <span
                    className="inline-flex items-center gap-0.5"
                    style={{ color }}
                  >
                    <ArrowRight className="h-3 w-3" />
                    {edgeDisplayLabel(edge)}
                    <ArrowRight className="h-3 w-3" />
                  </span>{" "}
                  <span className="text-zinc-200">{target}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
