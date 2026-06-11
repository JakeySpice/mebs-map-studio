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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { edgeDisplayLabel } from "@/types/graph";
import { layoutMap } from "@/lib/layout";
import { useMapStore } from "@/lib/store";
import { MebsNode, type MebsFlowNode } from "@/components/MebsNode";

const nodeTypes = { mebs: MebsNode };

const TREE_EDGE_STYLE: React.CSSProperties = {
  stroke: "rgba(255,255,255,0.18)",
  strokeWidth: 1.6,
};

const CROSS_STROKE = "#dfb163";

export function MapCanvas() {
  const map = useMapStore((s) => s.map);
  const selectedNodeId = useMapStore((s) => s.selectedNodeId);
  const selectedEdgeId = useMapStore((s) => s.selectedEdgeId);
  const editingNodeId = useMapStore((s) => s.editingNodeId);
  const relationshipMode = useMapStore((s) => s.relationshipMode);
  const selectNode = useMapStore((s) => s.selectNode);
  const selectEdge = useMapStore((s) => s.selectEdge);
  const clearSelection = useMapStore((s) => s.clearSelection);
  const addCrossLink = useMapStore((s) => s.addCrossLink);
  const focusRequest = useMapStore((s) => s.focusRequest);
  const { fitView, getZoom } = useReactFlow();

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

  const layout = React.useMemo(
    () => (map ? layoutMap(map) : null),
    [map]
  );

  const nodes = React.useMemo<MebsFlowNode[]>(() => {
    if (!layout) return [];
    return layout.items.map((item) => ({
      id: item.node.id,
      type: "mebs" as const,
      position: { x: item.x, y: item.y },
      draggable: false,
      connectable: relationshipMode,
      selected: item.node.id === selectedNodeId,
      data: {
        mebs: item.node,
        width: item.width,
        height: item.height,
        depth: item.depth,
        childCount: item.childCount,
        descendantCount: item.descendantCount,
        isEditing: item.node.id === editingNodeId,
        relationshipMode,
      },
    }));
  }, [layout, selectedNodeId, editingNodeId, relationshipMode]);

  const edges = React.useMemo<Edge[]>(() => {
    if (!layout || !map) return [];
    const result: Edge[] = [];

    for (const item of layout.items) {
      const parentId = item.node.parentId;
      if (parentId && layout.visibleIds.has(parentId)) {
        result.push({
          id: `tree-${item.node.id}`,
          source: parentId,
          target: item.node.id,
          sourceHandle: "tree-out",
          targetHandle: "tree-in",
          type: "default",
          style: TREE_EDGE_STYLE,
          selectable: false,
          focusable: false,
        });
      }
    }

    if (relationshipMode) {
      for (const edge of map.edges) {
        if (
          !layout.visibleIds.has(edge.source) ||
          !layout.visibleIds.has(edge.target)
        ) {
          continue;
        }
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
          labelStyle: {
            fill: "#f3ddae",
            fontSize: 11,
            fontWeight: 500,
          },
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
    }

    return result;
  }, [layout, map, relationshipMode, selectedEdgeId]);

  const onConnect = React.useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        addCrossLink(connection.source, connection.target);
      }
    },
    [addCrossLink]
  );

  if (!map) return null;

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => selectNode(node.id)}
      onEdgeClick={(_, edge) => {
        if (!edge.id.startsWith("tree-")) selectEdge(edge.id);
      }}
      onPaneClick={() => clearSelection()}
      onConnect={onConnect}
      fitView
      fitViewOptions={{ padding: 0.12, maxZoom: 0.95 }}
      minZoom={0.15}
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
      <Controls
        position="bottom-left"
        showInteractive={false}
        className="mebs-controls"
      />
    </ReactFlow>
  );
}
