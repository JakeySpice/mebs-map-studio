"use client";

import * as React from "react";
import { ArrowRight, Trash2, X } from "lucide-react";
import {
  ALL_EDGE_TYPES,
  EDGE_TYPE_LABELS,
  NODE_TYPE_INFO,
  nodeColors,
  type EdgeType,
} from "@/types/graph";
import { useMapStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EDGE_TYPE_ITEMS: Record<string, React.ReactNode> = Object.fromEntries(
  ALL_EDGE_TYPES.map((t) => [t, EDGE_TYPE_LABELS[t]])
);

export function EdgeInspector({ edgeId }: { edgeId: string }) {
  const map = useMapStore((s) => s.map);
  const updateEdge = useMapStore((s) => s.updateEdge);
  const deleteEdge = useMapStore((s) => s.deleteEdge);
  const selectNode = useMapStore((s) => s.selectNode);
  const clearSelection = useMapStore((s) => s.clearSelection);

  const edge = map?.edges.find((e) => e.id === edgeId);
  if (!map || !edge) return null;

  const source = map.nodes.find((n) => n.id === edge.source);
  const target = map.nodes.find((n) => n.id === edge.target);

  const endpoint = (node: typeof source) =>
    node ? (
      <button
        type="button"
        onClick={() => selectNode(node.id)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/60 px-2.5 py-2 text-left transition-colors hover:border-white/25"
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: nodeColors(node.type).bg }}
        />
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] text-zinc-200">
            {node.label}
          </span>
          <span className="block text-[10.5px] text-zinc-500">
            {NODE_TYPE_INFO[node.type].label}
          </span>
        </span>
      </button>
    ) : (
      <span className="text-[12px] text-zinc-500">missing node</span>
    );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="text-[12px] font-medium text-zinc-300">
          Relationship
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto text-zinc-400 hover:text-zinc-100"
          onClick={clearSelection}
        >
          <X />
        </Button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <div className="space-y-1.5">
          {endpoint(source)}
          <div className="flex items-center justify-center gap-1.5 py-0.5 text-[11.5px] text-amber-200/90">
            <ArrowRight className="h-3.5 w-3.5" />
            {edge.label?.trim() ? edge.label : EDGE_TYPE_LABELS[edge.type]}
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
          {endpoint(target)}
        </div>

        <Separator className="bg-white/8" />

        <div className="space-y-1.5">
          <Label className="text-[11px] tracking-wide text-zinc-400 uppercase">
            Relationship type
          </Label>
          <Select
            items={EDGE_TYPE_ITEMS}
            value={edge.type}
            onValueChange={(v) => {
              if (v) updateEdge(edge.id, { type: v as EdgeType });
            }}
          >
            <SelectTrigger className="w-full border-white/10 bg-zinc-900/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALL_EDGE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {EDGE_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] tracking-wide text-zinc-400 uppercase">
            Custom label (optional)
          </Label>
          <Input
            value={edge.label ?? ""}
            placeholder={EDGE_TYPE_LABELS[edge.type]}
            onChange={(e) => updateEdge(edge.id, { label: e.target.value })}
            className="border-white/10 bg-zinc-900/60 text-[13px]"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] tracking-wide text-zinc-400 uppercase">
            Notes
          </Label>
          <Textarea
            value={edge.notes ?? ""}
            rows={4}
            placeholder="Why might these be linked? What would test this?"
            onChange={(e) => updateEdge(edge.id, { notes: e.target.value })}
            className="border-white/10 bg-zinc-900/60 text-[13px]"
          />
        </div>

        <Separator className="bg-white/8" />

        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => deleteEdge(edge.id)}
        >
          <Trash2 data-icon="inline-start" /> Delete relationship
        </Button>
      </div>
    </div>
  );
}
