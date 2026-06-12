"use client";

import { create } from "zustand";
import type {
  EdgeType,
  LayoutMode,
  MebsEdge,
  MebsMap,
  MebsNode,
  NodeType,
} from "@/types/graph";
import {
  describeStorageError,
  loadMap,
  newId,
  saveMap,
} from "@/lib/storage";

/** How much of the semantic relationship layer is drawn. */
export type LinkVisibility = "off" | "selected" | "all";

interface MapState {
  map: MebsMap | null;
  mapMissing: boolean;
  storageError: string | null;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  /** node whose label is being edited inline on the canvas */
  editingNodeId: string | null;
  linkVisibility: LinkVisibility;
  /** asks the canvas to pan/zoom so these nodes are visible */
  focusRequest: { ids: string[]; nonce: number } | null;

  openMap: (id: string) => void;
  closeMap: () => void;
  clearStorageError: () => void;

  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  clearSelection: () => void;
  setEditingNode: (id: string | null) => void;
  setLinkVisibility: (v: LinkVisibility) => void;
  setLayoutMode: (mode: LayoutMode) => void;

  updateMapTitle: (title: string) => void;

  addChild: (parentId: string, partial?: Partial<MebsNode>) => string | null;
  updateNode: (id: string, patch: Partial<MebsNode>) => void;
  deleteNode: (id: string) => void;
  toggleCollapsed: (id: string) => void;
  setAllCollapsed: (collapsed: boolean) => void;

  addCrossLink: (source: string, target: string, type?: EdgeType) => string | null;
  updateEdge: (id: string, patch: Partial<MebsEdge>) => void;
  deleteEdge: (id: string) => void;
}

type CommitResult =
  | { map: MebsMap; storageError: null }
  | { storageError: string };

function commit(map: MebsMap): CommitResult {
  const next = { ...map, updatedAt: new Date().toISOString() };
  try {
    saveMap(next);
    return { map: next, storageError: null };
  } catch (err) {
    return { storageError: describeStorageError(err) };
  }
}

/** ids of `id` plus all its descendants */
export function subtreeIds(nodes: MebsNode[], id: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    if (n.parentId) {
      const list = childrenOf.get(n.parentId) ?? [];
      list.push(n.id);
      childrenOf.set(n.parentId, list);
    }
  }
  const ids = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    if (ids.has(cur)) continue;
    ids.add(cur);
    for (const child of childrenOf.get(cur) ?? []) stack.push(child);
  }
  return ids;
}

export const useMapStore = create<MapState>((set, get) => ({
  map: null,
  mapMissing: false,
  storageError: null,
  selectedNodeId: null,
  selectedEdgeId: null,
  editingNodeId: null,
  linkVisibility: "selected",
  focusRequest: null,

  openMap: (id) => {
    const map = loadMap(id);
    set({
      map,
      mapMissing: !map,
      storageError: null,
      selectedNodeId: null,
      selectedEdgeId: null,
      editingNodeId: null,
      linkVisibility: "selected",
    });
  },

  closeMap: () =>
    set({
      map: null,
      mapMissing: false,
      storageError: null,
      selectedNodeId: null,
      selectedEdgeId: null,
      editingNodeId: null,
      linkVisibility: "selected",
    }),

  clearStorageError: () => set({ storageError: null }),

  selectNode: (id) =>
    set({ selectedNodeId: id, selectedEdgeId: null }),

  selectEdge: (id) =>
    // selecting an edge implies wanting to see it: lift visibility off "off"
    set((s) => ({
      selectedEdgeId: id,
      selectedNodeId: null,
      linkVisibility: s.linkVisibility === "off" ? "selected" : s.linkVisibility,
    })),

  clearSelection: () =>
    set({ selectedNodeId: null, selectedEdgeId: null, editingNodeId: null }),

  setEditingNode: (id) => set({ editingNodeId: id }),

  setLinkVisibility: (v) =>
    set((s) => ({
      linkVisibility: v,
      // an edge selection makes no sense once the edges are hidden
      selectedEdgeId: v === "off" ? null : s.selectedEdgeId,
    })),

  setLayoutMode: (mode) => {
    const { map } = get();
    if (!map || (map.layoutMode ?? "botanical") === mode) return;
    set(commit({ ...map, layoutMode: mode }));
  },

  updateMapTitle: (title) => {
    const { map } = get();
    if (!map) return;
    set(commit({ ...map, title: title.trim() || map.title }));
  },

  addChild: (parentId, partial) => {
    const { map } = get();
    if (!map) return null;
    const parent = map.nodes.find((n) => n.id === parentId);
    if (!parent) return null;
    const siblings = map.nodes.filter((n) => n.parentId === parentId);
    const nextOrder =
      siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) + 1 : 0;
    const node: MebsNode = {
      id: newId(),
      type: (partial?.type ?? parent.childTypeHint ?? "domain") as NodeType,
      label: partial?.label ?? "New item",
      summary: partial?.summary,
      details: partial?.details,
      parentId,
      order: nextOrder,
      collapsed: false,
      childTypeHint: partial?.childTypeHint,
      templateId: partial?.templateId,
    };
    const nodes = map.nodes.map((n) =>
      // reveal the new child immediately
      n.id === parentId ? { ...n, collapsed: false } : n
    );
    const committed = commit({ ...map, nodes: [...nodes, node] });
    if (!("map" in committed)) {
      set(committed);
      return null;
    }
    set({
      ...committed,
      focusRequest: { ids: [parentId, node.id], nonce: Date.now() },
    });
    return node.id;
  },

  updateNode: (id, patch) => {
    const { map } = get();
    if (!map) return;
    set(
      commit({
        ...map,
        nodes: map.nodes.map((n) => (n.id === id ? { ...n, ...patch, id } : n)),
      })
    );
  },

  deleteNode: (id) => {
    const { map, selectedNodeId, selectedEdgeId } = get();
    if (!map) return;
    const node = map.nodes.find((n) => n.id === id);
    if (!node || node.type === "root") return;
    const doomed = subtreeIds(map.nodes, id);
    const survivingEdges = map.edges.filter(
      (e) => !doomed.has(e.source) && !doomed.has(e.target)
    );
    const committed = commit({
      ...map,
      nodes: map.nodes.filter((n) => !doomed.has(n.id)),
      edges: survivingEdges,
    });
    if (!("map" in committed)) {
      set(committed);
      return;
    }
    set({
      ...committed,
      selectedNodeId:
        selectedNodeId && doomed.has(selectedNodeId) ? null : selectedNodeId,
      selectedEdgeId:
        selectedEdgeId && !survivingEdges.some((e) => e.id === selectedEdgeId)
          ? null
          : selectedEdgeId,
    });
  },

  toggleCollapsed: (id) => {
    const { map } = get();
    if (!map) return;
    const node = map.nodes.find((n) => n.id === id);
    if (!node) return;
    const expanding = node.collapsed;
    const committed = commit({
      ...map,
      nodes: map.nodes.map((n) =>
        n.id === id ? { ...n, collapsed: !n.collapsed } : n
      ),
    });
    if (!("map" in committed)) {
      set(committed);
      return;
    }
    set({
      ...committed,
      focusRequest: expanding
        ? {
            ids: [
              id,
              ...map.nodes.filter((n) => n.parentId === id).map((n) => n.id),
            ],
            nonce: Date.now(),
          }
        : null,
    });
  },

  setAllCollapsed: (collapsed) => {
    const { map } = get();
    if (!map) return;
    set(
      commit({
        ...map,
        nodes: map.nodes.map((n) => {
          if (n.type === "root") return { ...n, collapsed: false };
          const hasChildren = map.nodes.some((c) => c.parentId === n.id);
          return hasChildren ? { ...n, collapsed } : n;
        }),
      })
    );
  },

  addCrossLink: (source, target, type = "contributes_to") => {
    const { map } = get();
    if (!map || source === target) return null;
    const exists = map.edges.some(
      (e) => e.source === source && e.target === target && e.type === type
    );
    if (exists) return null;
    const edge: MebsEdge = { id: newId(), source, target, type };
    const committed = commit({ ...map, edges: [...map.edges, edge] });
    if (!("map" in committed)) {
      set(committed);
      return null;
    }
    set({
      ...committed,
      linkVisibility: "all",
      selectedEdgeId: edge.id,
      selectedNodeId: null,
    });
    return edge.id;
  },

  updateEdge: (id, patch) => {
    const { map } = get();
    if (!map) return;
    set(
      commit({
        ...map,
        edges: map.edges.map((e) => (e.id === id ? { ...e, ...patch, id } : e)),
      })
    );
  },

  deleteEdge: (id) => {
    const { map, selectedEdgeId } = get();
    if (!map) return;
    const committed = commit({
      ...map,
      edges: map.edges.filter((e) => e.id !== id),
    });
    if (!("map" in committed)) {
      set(committed);
      return;
    }
    set({
      ...committed,
      selectedEdgeId: selectedEdgeId === id ? null : selectedEdgeId,
    });
  },
}));
