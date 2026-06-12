"use client";

import * as React from "react";
import {
  ArrowRight,
  CornerDownRight,
  Link2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  ALL_EDGE_TYPES,
  ALL_NODE_TYPES,
  EDGE_TYPE_LABELS,
  NODE_TYPE_INFO,
  nodeColors,
  type EdgeType,
  type MebsNode,
  type NodeType,
  type ZoneId,
} from "@/types/graph";
import { useMapStore } from "@/lib/store";
import { templateById, templateByLabel } from "@/lib/templates";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const NODE_TYPE_ITEMS: Record<string, React.ReactNode> = Object.fromEntries(
  ALL_NODE_TYPES.filter((t) => t !== "root").map((t) => [
    t,
    NODE_TYPE_INFO[t].label,
  ])
);

const EDGE_TYPE_ITEMS: Record<string, React.ReactNode> = Object.fromEntries(
  ALL_EDGE_TYPES.map((t) => [t, EDGE_TYPE_LABELS[t]])
);

const ZONE_CHOICE_LABELS: Record<ZoneId, string> = {
  roots: "Roots — person & context",
  trunk: "Trunk — formulation",
  behaviour: "Behaviour side",
  branches: "Branches — support plan",
  canopy: "Canopy — quality of life",
};

/** Zone choices by tree depth: top-level domains can go anywhere; children
 *  of a roots domain can only opt in/out of canopy promotion. */
const ZONE_CHOICES: Record<1 | 2, ZoneId[]> = {
  1: ["roots", "trunk", "behaviour", "branches", "canopy"],
  2: ["canopy", "roots"],
};

function TypeDot({ type }: { type: NodeType }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: nodeColors(type).bg }}
    />
  );
}

/** Text field that commits to the store on every keystroke. */
function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] tracking-wide text-zinc-400 uppercase">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function NodeInspector({ nodeId }: { nodeId: string }) {
  return <NodeInspectorContent key={nodeId} nodeId={nodeId} />;
}

function NodeInspectorContent({ nodeId }: { nodeId: string }) {
  const map = useMapStore((s) => s.map);
  const updateNode = useMapStore((s) => s.updateNode);
  const deleteNode = useMapStore((s) => s.deleteNode);
  const addChild = useMapStore((s) => s.addChild);
  const addCrossLink = useMapStore((s) => s.addCrossLink);
  const selectNode = useMapStore((s) => s.selectNode);
  const selectEdge = useMapStore((s) => s.selectEdge);
  const clearSelection = useMapStore((s) => s.clearSelection);
  const setEditingNode = useMapStore((s) => s.setEditingNode);

  const node = map?.nodes.find((n) => n.id === nodeId);

  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [linkDirection, setLinkDirection] = React.useState<"out" | "in">("out");
  const [linkType, setLinkType] = React.useState<EdgeType>("contributes_to");
  const [linkTarget, setLinkTarget] = React.useState<string | null>(null);
  const [showLinkForm, setShowLinkForm] = React.useState(false);

  if (!map || !node) return null;

  const children = map.nodes
    .filter((n) => n.parentId === node.id)
    .sort((a, b) => a.order - b.order);

  const template =
    node.type === "domain" || node.type === "root"
      ? (templateById(node.templateId) ?? templateByLabel(node.label))
      : undefined;
  const existingChildLabels = new Set(
    children.map((c) => c.label.trim().toLowerCase())
  );
  const suggestions =
    template?.suggestions.filter(
      (s) => !existingChildLabels.has(s.label.trim().toLowerCase())
    ) ?? [];

  const related = map.edges.filter(
    (e) => e.source === node.id || e.target === node.id
  );

  const otherNodes = map.nodes
    .filter((n) => n.id !== node.id && n.type !== "root")
    .sort((a, b) => a.label.localeCompare(b.label));
  const TARGET_ITEMS: Record<string, React.ReactNode> = Object.fromEntries(
    otherNodes.map((n) => [n.id, n.label])
  );

  const isRoot = node.type === "root";
  const descendantCount = countDescendants(map.nodes, node.id);

  const depth = (() => {
    const byId = new Map(map.nodes.map((n) => [n.id, n]));
    let d = 0;
    let cur: MebsNode | undefined = node;
    while (cur?.parentId && d <= map.nodes.length) {
      d += 1;
      cur = byId.get(cur.parentId);
    }
    return d;
  })();
  const zoneChoices = depth === 1 || depth === 2 ? ZONE_CHOICES[depth] : null;

  const handleAddLink = () => {
    if (!linkTarget) return;
    if (linkDirection === "out") addCrossLink(node.id, linkTarget, linkType);
    else addCrossLink(linkTarget, node.id, linkType);
    setShowLinkForm(false);
    setLinkTarget(null);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
        <TypeDot type={node.type} />
        <span className="text-[12px] font-medium text-zinc-300">
          {NODE_TYPE_INFO[node.type].label}
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
        <FieldRow label="Label">
          <Textarea
            value={node.label}
            rows={2}
            onChange={(e) => updateNode(node.id, { label: e.target.value })}
            className="min-h-9 resize-none border-white/10 bg-zinc-900/60 text-[13px] leading-snug"
          />
        </FieldRow>

        {!isRoot && (
          <FieldRow label="Type">
            <Select
              items={NODE_TYPE_ITEMS}
              value={node.type}
              onValueChange={(value) => {
                if (value) updateNode(node.id, { type: value as NodeType });
              }}
            >
              <SelectTrigger className="w-full border-white/10 bg-zinc-900/60">
                <span className="flex items-center gap-2">
                  <TypeDot type={node.type} />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                {ALL_NODE_TYPES.filter((t) => t !== "root").map((t) => (
                  <SelectItem key={t} value={t}>
                    <span className="flex items-center gap-2">
                      <TypeDot type={t} />
                      {NODE_TYPE_INFO[t].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
        )}

        {!isRoot && zoneChoices && (
          <FieldRow
            label={depth === 1 ? "Botanical zone" : "Canopy promotion"}
          >
            <Select
              items={{
                auto: "Auto (inferred)",
                ...Object.fromEntries(
                  zoneChoices.map((z) => [z, ZONE_CHOICE_LABELS[z]])
                ),
              }}
              value={node.mapZone ?? "auto"}
              onValueChange={(value) => {
                if (!value) return;
                updateNode(node.id, {
                  mapZone: value === "auto" ? undefined : (value as ZoneId),
                });
              }}
            >
              <SelectTrigger className="w-full border-white/10 bg-zinc-900/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (inferred)</SelectItem>
                {zoneChoices.map((z) => (
                  <SelectItem key={z} value={z}>
                    {ZONE_CHOICE_LABELS[z]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
        )}

        <FieldRow label="Summary">
          <Textarea
            value={node.summary ?? ""}
            rows={2}
            placeholder="One-line summary…"
            onChange={(e) => updateNode(node.id, { summary: e.target.value })}
            className="resize-none border-white/10 bg-zinc-900/60 text-[13px]"
          />
        </FieldRow>

        <FieldRow label="Details / practitioner notes">
          <Textarea
            value={node.details ?? ""}
            rows={4}
            placeholder="Context, observations, considerations…"
            onChange={(e) => updateNode(node.id, { details: e.target.value })}
            className="border-white/10 bg-zinc-900/60 text-[13px]"
          />
        </FieldRow>

        {suggestions.length > 0 && (
          <div className="space-y-2">
            <Label className="text-[11px] tracking-wide text-zinc-400 uppercase">
              Suggested branches
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() =>
                    addChild(node.id, {
                      label: s.label,
                      type: s.type,
                      childTypeHint: s.childTypeHint,
                    })
                  }
                  className="cursor-pointer rounded-full border border-white/12 bg-zinc-800/80 px-2.5 py-1 text-[11.5px] text-zinc-300 transition-colors hover:border-white/25 hover:bg-zinc-700/80 hover:text-zinc-100"
                >
                  + {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <Separator className="bg-white/8" />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] tracking-wide text-zinc-400 uppercase">
              Children ({children.length})
            </Label>
            <Button
              variant="outline"
              size="xs"
              className="border-white/12 bg-transparent text-zinc-300"
              onClick={() => {
                const id = addChild(node.id);
                if (id) {
                  selectNode(id);
                  setEditingNode(id);
                }
              }}
            >
              <Plus data-icon="inline-start" /> Add child
            </Button>
          </div>
          {children.length > 0 && (
            <ul className="space-y-1">
              {children.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => selectNode(c.id)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-zinc-300 transition-colors hover:bg-white/5 hover:text-zinc-100"
                  >
                    <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                    <TypeDot type={c.type} />
                    <span className="truncate">{c.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Separator className="bg-white/8" />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] tracking-wide text-zinc-400 uppercase">
              Relationships ({related.length})
            </Label>
            <Button
              variant="outline"
              size="xs"
              className="border-white/12 bg-transparent text-zinc-300"
              onClick={() => setShowLinkForm((v) => !v)}
            >
              <Link2 data-icon="inline-start" /> Link
            </Button>
          </div>

          {related.length > 0 && (
            <ul className="space-y-1">
              {related.map((e) => {
                const outgoing = e.source === node.id;
                const otherId = outgoing ? e.target : e.source;
                const other = map.nodes.find((n) => n.id === otherId);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => selectEdge(e.id)}
                      className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-white/5"
                    >
                      {!outgoing && (
                        <span className="truncate text-zinc-300">
                          {other?.label ?? "?"}
                        </span>
                      )}
                      <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-amber-200/90">
                        <ArrowRight className="h-3 w-3" />
                        {e.label?.trim() ? e.label : EDGE_TYPE_LABELS[e.type]}
                        <ArrowRight className="h-3 w-3" />
                      </span>
                      {outgoing && (
                        <span className="truncate text-zinc-300">
                          {other?.label ?? "?"}
                        </span>
                      )}
                      {!outgoing && (
                        <span className="shrink-0 text-zinc-500">this</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {showLinkForm && (
            <div className="space-y-2 rounded-lg border border-white/10 bg-zinc-900/60 p-2.5">
              <Select
                items={{
                  out: "This node →",
                  in: "→ This node",
                }}
                value={linkDirection}
                onValueChange={(v) => v && setLinkDirection(v as "out" | "in")}
              >
                <SelectTrigger size="sm" className="w-full border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="out">This node →</SelectItem>
                  <SelectItem value="in">→ This node</SelectItem>
                </SelectContent>
              </Select>
              <Select
                items={EDGE_TYPE_ITEMS}
                value={linkType}
                onValueChange={(v) => v && setLinkType(v as EdgeType)}
              >
                <SelectTrigger size="sm" className="w-full border-white/10">
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
              <Select
                items={TARGET_ITEMS}
                value={linkTarget}
                onValueChange={(v) => setLinkTarget(v)}
              >
                <SelectTrigger size="sm" className="w-full border-white/10">
                  <SelectValue placeholder="Choose a node…" />
                </SelectTrigger>
                <SelectContent>
                  {otherNodes.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      <span className="flex items-center gap-2">
                        <TypeDot type={n.type} />
                        <span className="truncate">{n.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="w-full"
                disabled={!linkTarget}
                onClick={handleAddLink}
              >
                Add relationship
              </Button>
            </div>
          )}
        </div>

        {!isRoot && (
          <>
            <Separator className="bg-white/8" />
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => {
                if (descendantCount > 0) setConfirmDelete(true);
                else deleteNode(node.id);
              }}
            >
              <Trash2 data-icon="inline-start" />
              Delete node
              {descendantCount > 0 ? ` (+${descendantCount} children)` : ""}
            </Button>
          </>
        )}
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this branch?</DialogTitle>
            <DialogDescription>
              “{node.label}” and {descendantCount} descendant
              {descendantCount === 1 ? "" : "s"} will be removed, along with
              any relationships that touch them. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDelete(false);
                deleteNode(node.id);
              }}
            >
              Delete branch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function countDescendants(nodes: MebsNode[], id: string): number {
  let count = 0;
  const stack = nodes.filter((n) => n.parentId === id).map((n) => n.id);
  while (stack.length) {
    const cur = stack.pop()!;
    count += 1;
    stack.push(...nodes.filter((n) => n.parentId === cur).map((n) => n.id));
  }
  return count;
}
