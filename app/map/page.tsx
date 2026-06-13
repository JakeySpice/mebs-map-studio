"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import type { MebsNode } from "@/types/graph";
import { subtreeIds, useMapStore } from "@/lib/store";
import { MapCanvas } from "@/components/MapCanvas";
import { Toolbar } from "@/components/Toolbar";
import { NodeInspector } from "@/components/NodeInspector";
import { EdgeInspector } from "@/components/EdgeInspector";
import { QuickFind } from "@/components/QuickFind";
import { RelationshipsPanel } from "@/components/RelationshipsPanel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Node ids in outline order (depth-first, sibling order, skipping collapsed
 *  branches) — the sequence ↑/↓ step through. */
function visibleOrder(nodes: MebsNode[]): string[] {
  const root = nodes.find((n) => n.type === "root");
  if (!root) return [];
  const childrenOf = new Map<string, MebsNode[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    const list = childrenOf.get(n.parentId) ?? [];
    list.push(n);
    childrenOf.set(n.parentId, list);
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => a.order - b.order);
  }
  const out: string[] = [];
  const walk = (n: MebsNode) => {
    out.push(n.id);
    if (n.collapsed) return;
    for (const child of childrenOf.get(n.id) ?? []) walk(child);
  };
  walk(root);
  return out;
}

// The map id travels as ?id= rather than a path segment so the whole app can
// be statically exported (dynamic route params can't be known at build time).
export default function MapPage() {
  return (
    <React.Suspense
      fallback={
        <main className="flex min-h-screen w-full items-center justify-center bg-[#161719]">
          <p className="text-sm text-zinc-500">Loading map…</p>
        </main>
      }
    >
      <MapView />
    </React.Suspense>
  );
}

function MapView() {
  const id = useSearchParams().get("id");
  const openMap = useMapStore((s) => s.openMap);
  const closeMap = useMapStore((s) => s.closeMap);
  const map = useMapStore((s) => s.map);
  const mapMissing = useMapStore((s) => s.mapMissing);
  const selectedNodeId = useMapStore((s) => s.selectedNodeId);
  const selectedEdgeId = useMapStore((s) => s.selectedEdgeId);
  const linkVisibility = useMapStore((s) => s.linkVisibility);
  const relationshipsPanelOpen = useMapStore((s) => s.relationshipsPanelOpen);
  const storageError = useMapStore((s) => s.storageError);
  const clearStorageError = useMapStore((s) => s.clearStorageError);
  const [quickFindOpen, setQuickFindOpen] = React.useState(false);
  /** keyboard Del on a node with descendants parks the id here for confirmation */
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(
    null
  );

  React.useEffect(() => {
    if (!id) return;
    openMap(id);
    return () => closeMap();
  }, [id, openMap, closeMap]);

  // Undo/redo shortcuts. Ignore keystrokes aimed at a text field (toolbar
  // title, inspector inputs, inline node-rename) so the platform's own
  // text-undo keeps working there.
  React.useEffect(() => {
    const isTextTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        el.isContentEditable
      );
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.altKey) return;
      const key = e.key.toLowerCase();
      const isUndo = key === "z" && !e.shiftKey;
      const isRedo = (key === "z" && e.shiftKey) || key === "y";
      if (!isUndo && !isRedo) return;
      if (isTextTarget(e.target)) return;
      const store = useMapStore.getState();
      if (!store.map) return;
      e.preventDefault();
      if (isRedo) store.redo();
      else store.undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Quick-find (Ctrl/Cmd+K). Kept separate from the undo handler: the browser
  // binds Ctrl+K, so always preventDefault, and unlike undo it may fire while a
  // text field is focused (no input-target guard). The undo effect ignores any
  // non-z/y key, so the two never collide.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuickFindOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Keyboard-first capture: with a node selected and focus on the canvas,
  // Enter chains siblings, Tab dives into a child, F2 renames, Del removes,
  // arrows walk the tree (Alt+↑/↓ reorders), Ctrl/Cmd+D duplicates a branch.
  // Inline-rename chaining itself lives in MebsNode's RenameInput — while a
  // rename is open, focus sits in its input and this handler stays out.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const store = useMapStore.getState();
      const { map, selectedNodeId } = store;
      if (!map || store.editingNodeId) return;

      // never fight a text field, an open dialog/menu, or a focused control —
      // Enter/Del/arrows all mean something else there
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el) {
        if (
          el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable
        ) {
          return;
        }
        if (
          el.closest(
            "button, a, aside, [role='dialog'], [role='listbox'], [role='menu']"
          )
        ) {
          return;
        }
      }
      if (document.querySelector("[role='dialog']")) return;

      const key = e.key;
      const mod = e.metaKey || e.ctrlKey;

      if (mod && !e.altKey && key.toLowerCase() === "d") {
        if (selectedNodeId) {
          e.preventDefault();
          store.duplicateSubtree(selectedNodeId);
        }
        return;
      }
      if (mod) return; // undo/redo/quick-find own the other mod combos

      if (key === "Escape") {
        if (selectedNodeId || store.selectedEdgeId) {
          e.preventDefault();
          store.clearSelection();
        }
        return;
      }

      const isArrow =
        key === "ArrowUp" ||
        key === "ArrowDown" ||
        key === "ArrowLeft" ||
        key === "ArrowRight";

      if (!selectedNodeId) {
        // arrows land you on the root so the keyboard journey can start
        if (isArrow) {
          const root = map.nodes.find((n) => n.type === "root");
          if (root) {
            e.preventDefault();
            store.selectNode(root.id, { reveal: true });
          }
        }
        return;
      }

      const node = map.nodes.find((n) => n.id === selectedNodeId);
      if (!node) return;

      if (e.altKey && (key === "ArrowUp" || key === "ArrowDown")) {
        e.preventDefault();
        store.moveNode(selectedNodeId, key === "ArrowUp" ? -1 : 1);
        return;
      }
      if (key === "ArrowUp" || key === "ArrowDown") {
        e.preventDefault();
        const order = visibleOrder(map.nodes);
        const idx = order.indexOf(selectedNodeId);
        if (idx === -1) return;
        const next = order[idx + (key === "ArrowDown" ? 1 : -1)];
        if (next) store.selectNode(next, { reveal: true });
        return;
      }
      if (key === "ArrowLeft") {
        e.preventDefault();
        const hasChildren = map.nodes.some(
          (n) => n.parentId === selectedNodeId
        );
        if (hasChildren && !node.collapsed) {
          store.toggleCollapsed(selectedNodeId);
        } else if (node.parentId) {
          store.selectNode(node.parentId, { reveal: true });
        }
        return;
      }
      if (key === "ArrowRight") {
        e.preventDefault();
        const children = map.nodes
          .filter((n) => n.parentId === selectedNodeId)
          .sort((a, b) => a.order - b.order);
        if (children.length === 0) return;
        if (node.collapsed) store.toggleCollapsed(selectedNodeId);
        else store.selectNode(children[0].id, { reveal: true });
        return;
      }
      if (key === "Enter") {
        e.preventDefault();
        const newId = node.parentId
          ? store.addSiblingAfter(selectedNodeId)
          : store.addChild(selectedNodeId); // root: Enter = first child
        if (newId) {
          store.selectNode(newId);
          store.setEditingNode(newId);
        }
        return;
      }
      if (key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        const newId = store.addChild(selectedNodeId);
        if (newId) {
          store.selectNode(newId);
          store.setEditingNode(newId);
        }
        return;
      }
      if (key === "F2") {
        e.preventDefault();
        store.setEditingNode(selectedNodeId);
        return;
      }
      if (key === "Delete" || key === "Backspace") {
        e.preventDefault();
        if (node.type === "root") return;
        const hasChildren = map.nodes.some(
          (n) => n.parentId === selectedNodeId
        );
        if (hasChildren) {
          setConfirmDeleteId(selectedNodeId);
        } else {
          const parentId = node.parentId;
          store.deleteNode(selectedNodeId);
          if (parentId) store.selectNode(parentId);
        }
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!id || mapMissing) {
    return (
      <main className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-[#161719] text-zinc-300">
        <p className="text-sm">
          This map could not be found in this browser’s storage.
        </p>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          Back to your maps
        </Button>
      </main>
    );
  }

  if (!map) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-[#161719]">
        <p className="text-sm text-zinc-500">Loading map…</p>
      </main>
    );
  }

  const inspectorOpen = selectedNodeId !== null || selectedEdgeId !== null;

  return (
    <ReactFlowProvider>
      <main className="relative h-screen w-full overflow-hidden bg-[#161719]">
        <MapCanvas />

        {/* floating toolbar */}
        <div className="pointer-events-none absolute top-4 left-1/2 z-20 -translate-x-1/2">
          <Toolbar />
        </div>

        {storageError && (
          <div className="absolute top-20 left-1/2 z-30 flex max-w-xl -translate-x-1/2 items-center gap-3 rounded-xl border border-rose-300/25 bg-rose-950/90 px-4 py-3 text-[12.5px] text-rose-100 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <p>{storageError}</p>
            <Button
              variant="ghost"
              size="xs"
              className="shrink-0 text-rose-100 hover:bg-white/10"
              onClick={clearStorageError}
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* relationships review panel (left — the inspector owns the right) */}
        {relationshipsPanelOpen && (
          <aside className="absolute top-20 bottom-4 left-4 z-20 w-[320px] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-md">
            <RelationshipsPanel />
          </aside>
        )}

        {/* inspector panel */}
        {inspectorOpen && (
          <aside className="absolute top-20 right-4 bottom-4 z-20 w-[340px] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-md">
            {selectedNodeId ? (
              <NodeInspector nodeId={selectedNodeId} />
            ) : selectedEdgeId ? (
              <EdgeInspector edgeId={selectedEdgeId} />
            ) : null}
          </aside>
        )}

        {/* mounted only while open so each invocation starts with fresh state */}
        {quickFindOpen && (
          <QuickFind open onClose={() => setQuickFindOpen(false)} />
        )}

        {/* keyboard-delete confirmation for nodes with descendants */}
        <ConfirmDeleteDialog
          nodeId={confirmDeleteId}
          onClose={() => setConfirmDeleteId(null)}
        />

        {/* hints */}
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/8 bg-zinc-950/75 px-4 py-1.5 text-[11.5px] text-zinc-500 backdrop-blur-sm">
          {selectedNodeId ? (
            <>
              <Kbd>Enter</Kbd> add item · <Kbd>Tab</Kbd> add child ·{" "}
              <Kbd>F2</Kbd> rename · <Kbd>Del</Kbd> remove · <Kbd>↑↓←→</Kbd>{" "}
              navigate · <Kbd>Alt+↑↓</Kbd> reorder
            </>
          ) : (
            <>
              Click a node to inspect · double-click to rename ·{" "}
              <Kbd>Ctrl+K</Kbd> find
            </>
          )}
          {linkVisibility === "all" && (
            <span className="text-amber-200/80">
              {" "}
              · drag from a node’s lower dot to link it to another node
            </span>
          )}
        </div>
      </main>
    </ReactFlowProvider>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-white/12 bg-white/5 px-1 py-px font-sans text-[10.5px] text-zinc-400">
      {children}
    </kbd>
  );
}

function ConfirmDeleteDialog({
  nodeId,
  onClose,
}: {
  nodeId: string | null;
  onClose: () => void;
}) {
  const map = useMapStore((s) => s.map);
  const deleteNode = useMapStore((s) => s.deleteNode);
  const selectNode = useMapStore((s) => s.selectNode);

  const node = nodeId ? map?.nodes.find((n) => n.id === nodeId) : undefined;
  const descendantCount =
    map && nodeId ? subtreeIds(map.nodes, nodeId).size - 1 : 0;

  return (
    <Dialog open={node !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this branch?</DialogTitle>
          <DialogDescription>
            “{node?.label || "Unnamed"}” and {descendantCount} descendant
            {descendantCount === 1 ? "" : "s"} will be removed, along with any
            relationships that touch them. You can undo this with Ctrl+Z.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (node) {
                const parentId = node.parentId;
                deleteNode(node.id);
                if (parentId) selectNode(parentId);
              }
              onClose();
            }}
          >
            Delete branch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
