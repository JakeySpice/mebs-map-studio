"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReactFlowProvider } from "@xyflow/react";
import { useMapStore } from "@/lib/store";
import { MapCanvas } from "@/components/MapCanvas";
import { Toolbar } from "@/components/Toolbar";
import { NodeInspector } from "@/components/NodeInspector";
import { EdgeInspector } from "@/components/EdgeInspector";
import { QuickFind } from "@/components/QuickFind";
import { RelationshipsPanel } from "@/components/RelationshipsPanel";
import { Button } from "@/components/ui/button";

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

        {/* hints */}
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/8 bg-zinc-950/75 px-4 py-1.5 text-[11.5px] text-zinc-500 backdrop-blur-sm">
          Click a node to inspect · double-click to rename · hover for{" "}
          <span className="text-zinc-400">+</span> to add a branch
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
