"use client";

import * as React from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  EDGE_TONE_COLORS,
  EDGE_TONES,
  edgeBadgeLabel,
  edgeDisplayLabel,
  layoutModeOf,
} from "@/types/graph";
import {
  APEX_ID,
  layoutBotanical,
  layoutOutlineUnified,
  type BotanicalLayout,
} from "@/lib/layoutBotanical";
import { useMapStore } from "@/lib/store";
import { MebsNode, type MebsFlowNode } from "@/components/MebsNode";
import { ApexNode } from "@/components/ApexNode";
import { SemanticEdge } from "@/components/SemanticEdge";
import { ZoneBackdrops } from "@/components/ZoneBackdrops";

const nodeTypes = { mebs: MebsNode, mebsApex: ApexNode };
const edgeTypes = { mebsSemantic: SemanticEdge };

const TREE_EDGE_STYLE: React.CSSProperties = {
  stroke: "rgba(255,255,255,0.18)",
  strokeWidth: 1.6,
};

const SPINE_EDGE_STYLE: React.CSSProperties = {
  stroke: "rgba(255,255,255,0.07)",
  strokeWidth: 5,
};

const CROSS_STROKE = "#dfb163";

/** Same-side C-curves park in lanes so stacked links don't overlap. */
const MAX_LANES = 6;

function isStructuralEdgeId(id: string) {
  return (
    id.startsWith("tree-") ||
    id.startsWith("rail-") ||
    id.startsWith("apex-") ||
    id.startsWith("asp-") ||
    id === "spine"
  );
}

export function MapCanvas() {
  const map = useMapStore((s) => s.map);
  const selectedNodeId = useMapStore((s) => s.selectedNodeId);
  const selectedEdgeId = useMapStore((s) => s.selectedEdgeId);
  const editingNodeId = useMapStore((s) => s.editingNodeId);
  const linkVisibility = useMapStore((s) => s.linkVisibility);
  const selectNode = useMapStore((s) => s.selectNode);
  const selectEdge = useMapStore((s) => s.selectEdge);
  const clearSelection = useMapStore((s) => s.clearSelection);
  const addCrossLink = useMapStore((s) => s.addCrossLink);
  const focusRequest = useMapStore((s) => s.focusRequest);
  const { fitView, getZoom } = useReactFlow();

  const layoutMode = map ? layoutModeOf(map) : "botanical";
  const mapNodes = map?.nodes ?? null;

  // pan (without zooming in) so freshly revealed nodes are on screen
  React.useEffect(() => {
    if (!focusRequest) return;
    const timer = setTimeout(() => {
      fitView({
        nodes: focusRequest.ids.map((id) => ({ id })),
        duration: 380,
        padding: 0.3,
        maxZoom: getZoom(),
      });
    }, 40);
    return () => clearTimeout(timer);
  }, [focusRequest, fitView, getZoom]);

  // refit when the layout mode flips — the geometry changes completely.
  // Skips the first run: the initial fit is handled by the fitView prop.
  const firstModeRun = React.useRef(true);
  React.useEffect(() => {
    if (firstModeRun.current) {
      firstModeRun.current = false;
      return;
    }
    const frame = requestAnimationFrame(() =>
      fitView({ padding: 0.1, duration: 400 })
    );
    return () => cancelAnimationFrame(frame);
  }, [layoutMode, fitView]);

  // keyed on the nodes array + mode: edge-only commits reuse the nodes
  // reference (see store commit), so edge edits skip the relayout entirely
  const layout = React.useMemo<BotanicalLayout | null>(() => {
    if (!mapNodes) return null;
    return layoutMode === "botanical"
      ? layoutBotanical({ nodes: mapNodes })
      : layoutOutlineUnified({ nodes: mapNodes });
  }, [mapNodes, layoutMode]);

  // focus: when the selected node participates in relationships, spotlight
  // its clinical neighbourhood and let everything else recede
  const focus = React.useMemo(() => {
    if (!map || !selectedNodeId) return null;
    const incident = map.edges.filter(
      (e) => e.source === selectedNodeId || e.target === selectedNodeId
    );
    if (incident.length === 0) return null;
    const related = new Set<string>([selectedNodeId]);
    for (const e of incident) {
      related.add(e.source);
      related.add(e.target);
    }
    const sel = map.nodes.find((n) => n.id === selectedNodeId);
    if (sel?.parentId) related.add(sel.parentId);
    for (const n of map.nodes) {
      if (n.parentId === selectedNodeId) related.add(n.id);
    }
    return { related, incidentIds: new Set(incident.map((e) => e.id)) };
  }, [map, selectedNodeId]);

  const nodes = React.useMemo<Node[]>(() => {
    if (!layout) return [];
    const result: Node[] = layout.items.map(
      (item): MebsFlowNode => ({
        id: item.node.id,
        type: "mebs" as const,
        position: { x: item.x, y: item.y },
        draggable: false,
        connectable: linkVisibility === "all",
        selected: item.node.id === selectedNodeId,
        data: {
          mebs: item.node,
          width: item.width,
          height: item.height,
          depth: item.depth,
          childCount: item.childCount,
          descendantCount: item.descendantCount,
          isEditing: item.node.id === editingNodeId,
          relationshipMode: linkVisibility === "all",
          dir: item.dir,
          dimmed: focus ? !focus.related.has(item.node.id) : false,
        },
      })
    );
    if (layout.apex) {
      result.push({
        id: APEX_ID,
        type: "mebsApex",
        position: layout.apex,
        draggable: false,
        selectable: false,
        focusable: false,
        connectable: false,
        style: { pointerEvents: "none" },
        data: {},
      });
    }
    return result;
  }, [layout, selectedNodeId, editingNodeId, linkVisibility, focus]);

  const edges = React.useMemo<Edge[]>(() => {
    if (!layout || !map) return [];
    const result: Edge[] = [];
    const rectOf = new Map(
      layout.items.map((i) => [
        i.node.id,
        { x: i.x, y: i.y, w: i.width, h: i.height },
      ])
    );
    const isDim = (id: string) =>
      focus ? id !== APEX_ID && !focus.related.has(id) : false;

    // ---- structural edges (spine first so it stays underneath) ----------
    const ordered = [...layout.structEdges].sort(
      (a, b) => (a.kind === "spine" ? -1 : 0) - (b.kind === "spine" ? -1 : 0)
    );
    for (const spec of ordered) {
      if (spec.kind === "aspiration") {
        result.push({
          id: spec.id,
          source: spec.source,
          target: spec.target,
          sourceHandle: spec.sourceHandle,
          targetHandle: spec.targetHandle,
          type: "mebsSemantic",
          selectable: false,
          focusable: false,
          data: {
            sSide: spec.side ?? -1,
            tSide: spec.side ?? -1,
            lane: 1,
            par: 0,
            tone: "#8fd0ac",
            badge: "",
            dimmed: false,
            emphasized:
              selectedNodeId === spec.source || selectedNodeId === spec.target,
            showBadge: false,
            aspiration: true,
          },
        });
        continue;
      }
      const dimmed = isDim(spec.source) || isDim(spec.target);
      const base: Edge = {
        id: spec.id,
        source: spec.source,
        target: spec.target,
        sourceHandle: spec.sourceHandle,
        targetHandle: spec.targetHandle,
        type: "default",
        style: { ...TREE_EDGE_STYLE, opacity: dimmed ? 0.3 : 1 },
        selectable: false,
        focusable: false,
      };
      if (spec.kind === "spine") {
        base.type = "straight";
        base.style = { ...SPINE_EDGE_STYLE, opacity: dimmed ? 0.5 : 1 };
      } else if (spec.kind === "rail") {
        base.type = "smoothstep";
        (base as Edge & { pathOptions?: { borderRadius: number } }).pathOptions =
          { borderRadius: 8 };
      }
      result.push(base);
    }

    // ---- semantic relationship edges, gated by the tri-state -------------
    const semVisible =
      linkVisibility === "all"
        ? map.edges
        : linkVisibility === "selected"
          ? map.edges.filter(
              (e) =>
                e.source === selectedNodeId ||
                e.target === selectedNodeId ||
                e.id === selectedEdgeId
            )
          : map.edges.filter((e) => e.id === selectedEdgeId);

    const onCanvas = semVisible.filter(
      (e) => layout.visibleIds.has(e.source) && layout.visibleIds.has(e.target)
    );

    if (layoutMode === "outline") {
      // v0.1 rendering, unchanged: amber dashed default bezier with a label
      for (const edge of onCanvas) {
        const isSelected = edge.id === selectedEdgeId;
        result.push({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: "link-out",
          targetHandle: "link-in",
          type: "default",
          label: edgeDisplayLabel(edge),
          selected: isSelected,
          zIndex: isSelected ? 1200 : 1000,
          style: {
            stroke: CROSS_STROKE,
            strokeWidth: isSelected ? 2.4 : 1.6,
            strokeDasharray: "7 5",
            opacity: isSelected ? 1 : 0.8,
          },
          labelStyle: { fill: "#f3ddae", fontSize: 11, fontWeight: 500 },
          labelBgStyle: { fill: "#262019", fillOpacity: 0.95 },
          labelBgPadding: [7, 4] as [number, number],
          labelBgBorderRadius: 7,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: CROSS_STROKE,
            width: 16,
            height: 16,
          },
        });
      }
      return result;
    }

    // botanical: side-ported curves with lanes, parallel offsets and badges
    interface SemSpec {
      edge: (typeof onCanvas)[number];
      sSide: -1 | 1;
      tSide: -1 | 1;
      sourceHandle: string;
      targetHandle: string;
      par: number;
      lane: number;
      y0: number;
      y1: number;
    }
    const pairSeen = new Map<string, number>();
    const specs: SemSpec[] = [];
    for (const edge of onCanvas) {
      const s = rectOf.get(edge.source);
      const t = rectOf.get(edge.target);
      if (!s || !t) continue;
      const scx = s.x + s.w / 2;
      const tcx = t.x + t.w / 2;
      const dx = tcx - scx;
      let sSide: -1 | 1, tSide: -1 | 1, sourceHandle: string, targetHandle: string;
      if (dx > 80) {
        sSide = 1;
        tSide = -1;
        sourceHandle = "tree-out";
        targetHandle = "tree-in";
      } else if (dx < -80) {
        sSide = -1;
        tSide = 1;
        sourceHandle = "out-l";
        targetHandle = "in-r";
      } else {
        // near-vertical: bow out to the side, away from the central axis
        const side: -1 | 1 = (scx + tcx) / 2 >= 0 ? 1 : -1;
        sSide = tSide = side;
        sourceHandle = side === 1 ? "tree-out" : "out-l";
        targetHandle = side === 1 ? "in-r" : "tree-in";
      }
      const pairKey =
        edge.source < edge.target
          ? `${edge.source}|${edge.target}`
          : `${edge.target}|${edge.source}`;
      const i = pairSeen.get(pairKey) ?? 0;
      pairSeen.set(pairKey, i + 1);
      const par = i === 0 ? 0 : i % 2 ? Math.ceil(i / 2) : -Math.ceil(i / 2);
      const sy = s.y + s.h / 2;
      const ty = t.y + t.h / 2;
      specs.push({
        edge,
        sSide,
        tSide,
        sourceHandle,
        targetHandle,
        par,
        lane: 0,
        y0: Math.min(sy, ty),
        y1: Math.max(sy, ty),
      });
    }

    // lane assignment: same-side C-curves with overlapping vertical spans
    // step outwards one lane at a time (greedy interval colouring)
    for (const side of [-1, 1] as const) {
      const cs = specs
        .filter((sp) => sp.sSide === sp.tSide && sp.sSide === side)
        .sort((a, b) => a.y0 - b.y0);
      const laneEnds: number[] = [];
      for (const sp of cs) {
        let lane = laneEnds.findIndex((end) => sp.y0 > end);
        if (lane === -1) lane = Math.min(laneEnds.length, MAX_LANES - 1);
        laneEnds[lane] = Math.max(laneEnds[lane] ?? -Infinity, sp.y1);
        sp.lane = lane;
      }
    }

    for (const sp of specs) {
      const { edge } = sp;
      const isSelected = edge.id === selectedEdgeId;
      const incident = focus?.incidentIds.has(edge.id) ?? false;
      const tone = EDGE_TONE_COLORS[EDGE_TONES[edge.type]];
      result.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: sp.sourceHandle,
        targetHandle: sp.targetHandle,
        type: "mebsSemantic",
        selected: isSelected,
        zIndex: isSelected || incident ? 1200 : 1000,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: tone,
          width: 14,
          height: 14,
        },
        data: {
          sSide: sp.sSide,
          tSide: sp.tSide,
          lane: sp.lane,
          par: sp.par,
          tone,
          badge: edgeBadgeLabel(edge),
          dimmed: focus ? !incident : false,
          emphasized: isSelected || incident,
          showBadge: true,
        },
      });
    }

    return result;
  }, [layout, map, layoutMode, linkVisibility, selectedNodeId, selectedEdgeId, focus]);

  const onConnect = React.useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        addCrossLink(connection.source, connection.target);
      }
    },
    [addCrossLink]
  );

  if (!map) return null;

  const botanical = layoutMode === "botanical";

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={(_, node) => {
        if (node.id !== APEX_ID) selectNode(node.id);
      }}
      onEdgeClick={(_, edge) => {
        if (!isStructuralEdgeId(edge.id)) selectEdge(edge.id);
      }}
      onPaneClick={() => clearSelection()}
      onConnect={onConnect}
      fitView
      fitViewOptions={
        botanical
          ? { padding: 0.08, maxZoom: 0.85 }
          : { padding: 0.12, maxZoom: 0.95 }
      }
      minZoom={botanical ? 0.08 : 0.15}
      maxZoom={1.8}
      zoomOnDoubleClick={false}
      nodesDraggable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      deleteKeyCode={null}
      connectionLineStyle={{
        stroke: CROSS_STROKE,
        strokeWidth: 1.8,
        strokeDasharray: "7 5",
      }}
      proOptions={{ hideAttribution: false }}
      className="bg-[#161719]"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={28}
        size={1.4}
        color="#27292e"
      />
      {botanical && layout && <ZoneBackdrops rects={layout.zoneRects} />}
      <Controls
        position="bottom-left"
        showInteractive={false}
        className="mebs-controls"
      />
    </ReactFlow>
  );
}
