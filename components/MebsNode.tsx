"use client";

import * as React from "react";
import {
  Handle,
  Position,
  useConnection,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Plus,
} from "lucide-react";
import { nodeColors, type MebsNode as MebsNodeData } from "@/types/graph";
import type { GrowDir } from "@/lib/layoutBotanical";
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
  /** direction this node's children grow (botanical) — picks the chevron */
  dir: GrowDir;
  /** focus mode: fade nodes unrelated to the selection */
  dimmed: boolean;
}

const COLLAPSE_CHEVRON: Record<GrowDir, React.ComponentType<{ className?: string }>> = {
  right: ChevronLeft,
  left: ChevronRight,
  down: ChevronUp,
  up: ChevronDown,
};

export type MebsFlowNode = Node<MebsFlowData, "mebs">;

/** What the user asked for when ending a rename — drives chained entry. */
export type RenameIntent = "stop" | "sibling" | "child" | "outdent" | "cancel";

function RenameInput({
  label,
  onFinish,
}: {
  label: string;
  onFinish: (label: string, intent: RenameIntent) => void;
}) {
  const [draft, setDraft] = React.useState(label);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Chaining moves editing to a freshly added node, unmounting this input.
  // The unmount fires a stray blur; once finished, ignore it so it can't
  // clobber the next node's editing state.
  const doneRef = React.useRef(false);

  // React's autoFocus fires while React Flow still has the freshly mounted
  // node hidden for measurement, so focus() silently fails and keystrokes
  // fall through to the canvas. Retry across a few frames until it sticks.
  React.useEffect(() => {
    let raf = 0;
    let attempts = 0;
    const tryFocus = () => {
      const el = inputRef.current;
      if (!el || attempts++ > 20) return;
      el.focus({ preventScroll: true });
      if (document.activeElement === el) el.select();
      else raf = requestAnimationFrame(tryFocus);
    };
    tryFocus();
    return () => cancelAnimationFrame(raf);
  }, []);

  const finish = (intent: RenameIntent) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onFinish(draft.trim(), intent);
  };

  return (
    <input
      ref={inputRef}
      value={draft}
      placeholder="Name this item…"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish("stop")}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") finish("sibling");
        if (e.key === "Tab") {
          e.preventDefault();
          finish(e.shiftKey ? "outdent" : "child");
        }
        if (e.key === "Escape") finish("cancel");
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className="nodrag w-full bg-transparent text-[13px] font-medium outline-none placeholder:text-[#1f2430]/45"
      style={{ color: "#1f2430" }}
    />
  );
}

function MebsNodeComponent({ id, data, selected }: NodeProps<MebsFlowNode>) {
  const { mebs, width, height, depth, childCount, descendantCount } = data;
  const colors = nodeColors(mebs.type);
  const toggleCollapsed = useMapStore((s) => s.toggleCollapsed);
  const addChild = useMapStore((s) => s.addChild);
  const addSiblingAfter = useMapStore((s) => s.addSiblingAfter);
  const deleteNode = useMapStore((s) => s.deleteNode);
  const selectNode = useMapStore((s) => s.selectNode);
  const setEditingNode = useMapStore((s) => s.setEditingNode);
  const updateNode = useMapStore((s) => s.updateNode);

  /**
   * End an inline rename, optionally chaining straight into the next item:
   * Enter = sibling, Tab = child, Shift+Tab = sibling of the parent. An empty
   * commit ends the chain — and deletes the node if it was never named, so
   * "Enter on a blank item" is the natural way out.
   */
  const finishRename = (label: string, intent: RenameIntent) => {
    const wasUnnamed = mebs.label === "";
    if (intent === "cancel" || label === "") {
      setEditingNode(null);
      if (wasUnnamed) deleteNode(id);
      return;
    }
    if (label !== mebs.label) updateNode(id, { label });
    if (intent === "sibling" || intent === "child" || intent === "outdent") {
      const nextId =
        intent === "sibling"
          ? addSiblingAfter(id)
          : intent === "child"
            ? addChild(id)
            : mebs.parentId
              ? addSiblingAfter(mebs.parentId)
              : null;
      if (nextId) {
        selectNode(nextId);
        setEditingNode(nextId);
        return;
      }
    }
    setEditingNode(null);
  };

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
          : "shadow-[0_3px_12px_rgba(0,0,0,0.35)] hover:shadow-[0_0_0_2px_rgba(255,255,255,0.35),0_6px_18px_rgba(0,0,0,0.4)]",
        data.dimmed && "opacity-35 saturate-50"
      )}
      style={{
        width,
        height,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        transition: "box-shadow 150ms ease, opacity 200ms ease, filter 200ms ease",
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
      {/* invisible anchors completing the grid: botanical structural edges
          and side-ported semantic edges pick from these by id */}
      <Handle
        id="out-t"
        type="source"
        position={Position.Top}
        isConnectable={false}
        className="!pointer-events-none !h-1.5 !w-1.5 !border-0 !bg-transparent !opacity-0"
      />
      <Handle
        id="in-b"
        type="target"
        position={Position.Bottom}
        className="!pointer-events-none !h-1.5 !w-1.5 !border-0 !bg-transparent !opacity-0"
      />
      <Handle
        id="out-l"
        type="source"
        position={Position.Left}
        isConnectable={false}
        className="!pointer-events-none !h-1.5 !w-1.5 !border-0 !bg-transparent !opacity-0"
      />
      <Handle
        id="in-r"
        type="target"
        position={Position.Right}
        className="!pointer-events-none !h-1.5 !w-1.5 !border-0 !bg-transparent !opacity-0"
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
          onFinish={finishRename}
        />
      ) : (
        <span
          className={cn(
            "line-clamp-3 w-full pr-1 leading-[18px]",
            isRoot ? "text-[13.5px] font-semibold" : "text-[13px] font-medium",
            depth === 1 && "font-semibold",
            !mebs.label && "opacity-45"
          )}
          style={{ color: "#1f2430" }}
        >
          {mebs.label || "Unnamed"}
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
            (() => {
              const Chevron = COLLAPSE_CHEVRON[data.dir] ?? ChevronLeft;
              return <Chevron className="h-3.5 w-3.5" />;
            })()
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
