"use client";

import * as React from "react";
import {
  Handle,
  Position,
  useConnection,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import { ChevronLeft, Plus } from "lucide-react";
import { nodeColors, type MebsNode as MebsNodeData } from "@/types/graph";
import { useMapStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export interface MebsFlowData extends Record<string, unknown> {
  mebs: MebsNodeData;
  width: number;
  height: number;
  depth: number;
  childCount: number;
  descendantCount: number;
  isEditing: boolean;
  relationshipMode: boolean;
}

export type MebsFlowNode = Node<MebsFlowData, "mebs">;

function RenameInput({
  label,
  onCommit,
  onCancel,
}: {
  label: string;
  onCommit: (label: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = React.useState(label);

  const commitRename = () => {
    onCommit(draft.trim());
  };

  return (
    <input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commitRename}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") commitRename();
        if (e.key === "Escape") onCancel();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className="nodrag w-full bg-transparent text-[13px] font-medium outline-none"
      style={{ color: "#1f2430" }}
    />
  );
}

function MebsNodeComponent({ id, data, selected }: NodeProps<MebsFlowNode>) {
  const { mebs, width, height, depth, childCount, descendantCount } = data;
  const colors = nodeColors(mebs.type);
  const toggleCollapsed = useMapStore((s) => s.toggleCollapsed);
  const addChild = useMapStore((s) => s.addChild);
  const selectNode = useMapStore((s) => s.selectNode);
  const setEditingNode = useMapStore((s) => s.setEditingNode);
  const updateNode = useMapStore((s) => s.updateNode);

  const connection = useConnection();
  const connecting = connection.inProgress;
  const isConnectionSource =
    connection.inProgress && connection.fromNode?.id === id;

  const handleAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    const childId = addChild(id);
    if (childId) {
      selectNode(childId);
      setEditingNode(childId);
    }
  };

  const isRoot = mebs.type === "root";

  return (
    <div
      className={cn(
        "group relative flex items-center rounded-2xl border px-3.5 transition-shadow",
        selected
          ? "shadow-[0_0_0_2.5px_rgba(255,255,255,0.85),0_8px_24px_rgba(0,0,0,0.45)]"
          : "shadow-[0_3px_12px_rgba(0,0,0,0.35)] hover:shadow-[0_0_0_2px_rgba(255,255,255,0.35),0_6px_18px_rgba(0,0,0,0.4)]"
      )}
      style={{
        width,
        height,
        backgroundColor: colors.bg,
        borderColor: colors.border,
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditingNode(id);
      }}
    >
      {/* tree edges */}
      <Handle
        id="tree-in"
        type="target"
        position={Position.Left}
        className="!pointer-events-none !h-1.5 !w-1.5 !border-0 !bg-transparent"
      />
      <Handle
        id="tree-out"
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!pointer-events-none !h-1.5 !w-1.5 !border-0 !bg-transparent"
      />
      {/* cross-link handles: drag from the bottom dot to another node */}
      <Handle
        id="link-in"
        type="target"
        position={Position.Top}
        className={cn(
          "!h-2.5 !w-2.5 !rounded-full !border !border-amber-200/80 !bg-amber-300/90 transition-opacity",
          data.relationshipMode && connecting && !isConnectionSource
            ? "!opacity-80"
            : "!pointer-events-none !opacity-0"
        )}
      />
      <Handle
        id="link-out"
        type="source"
        position={Position.Bottom}
        className={cn(
          "!h-2.5 !w-2.5 !rounded-full !border !border-amber-200/80 !bg-amber-400 transition-opacity hover:!scale-125",
          data.relationshipMode && !connecting
            ? "!cursor-crosshair !opacity-0 group-hover:!opacity-90"
            : data.relationshipMode && isConnectionSource
              ? "!opacity-90"
              : "!pointer-events-none !opacity-0"
        )}
      />

      {data.isEditing ? (
        <RenameInput
          key={`${id}:${mebs.label}`}
          label={mebs.label}
          onCommit={(label) => {
            if (label && label !== mebs.label) updateNode(id, { label });
            setEditingNode(null);
          }}
          onCancel={() => setEditingNode(null)}
        />
      ) : (
        <span
          className={cn(
            "line-clamp-3 w-full pr-1 leading-[18px]",
            isRoot ? "text-[13.5px] font-semibold" : "text-[13px] font-medium",
            depth === 1 && "font-semibold"
          )}
          style={{ color: "#1f2430" }}
        >
          {mebs.label}
        </span>
      )}

      {/* expand / collapse chip */}
      {childCount > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapsed(id);
          }}
          title={mebs.collapsed ? "Expand branch" : "Collapse branch"}
          className="nodrag absolute top-1/2 -right-3 flex h-[22px] min-w-[22px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border px-1 text-[10.5px] font-semibold shadow-sm transition-transform hover:scale-110"
          style={{
            backgroundColor: colors.chip,
            borderColor: colors.border,
            color: "#1f2430",
          }}
        >
          {mebs.collapsed ? (
            descendantCount
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      )}

      {/* add child */}
      <button
        type="button"
        onClick={handleAddChild}
        title="Add child node"
        className={cn(
          "nodrag absolute flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full border border-white/25 bg-zinc-800 text-zinc-200 opacity-0 shadow-sm transition-all hover:scale-110 hover:bg-zinc-700 focus-visible:opacity-100 group-hover:opacity-100",
          childCount > 0 ? "-right-3 -bottom-3" : "top-1/2 -right-3 -translate-y-1/2",
          selected && "opacity-100"
        )}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export const MebsNode = React.memo(MebsNodeComponent);
