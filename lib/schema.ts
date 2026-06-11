import { z } from "zod";
import { ALL_EDGE_TYPES, ALL_NODE_TYPES } from "@/types/graph";

const nodeTypeSchema = z.enum(ALL_NODE_TYPES as [string, ...string[]]);
const edgeTypeSchema = z.enum(ALL_EDGE_TYPES as [string, ...string[]]);

export const mebsNodeSchema = z.object({
  id: z.string().min(1),
  type: nodeTypeSchema,
  label: z.string(),
  summary: z.string().optional(),
  details: z.string().optional(),
  parentId: z.string().nullable(),
  order: z.number(),
  collapsed: z.boolean(),
  childTypeHint: nodeTypeSchema.optional(),
  templateId: z.string().optional(),
});

export const mebsEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: edgeTypeSchema,
  label: z.string().optional(),
  notes: z.string().optional(),
});

export const mebsMapSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  participantLabel: z.string(),
  framework: z.literal("MEBS"),
  version: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  nodes: z.array(mebsNodeSchema),
  edges: z.array(mebsEdgeSchema),
}).superRefine((map, ctx) => {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const nodeById = new Map<string, { id: string; parentId: string | null }>();

  for (const [index, node] of map.nodes.entries()) {
    if (nodeIds.has(node.id)) {
      ctx.addIssue({
        code: "custom",
        path: ["nodes", index, "id"],
        message: "Node ids must be unique.",
      });
    }
    nodeIds.add(node.id);
    nodeById.set(node.id, node);
  }

  const roots = map.nodes.filter((node) => node.parentId === null);
  if (roots.length !== 1) {
    ctx.addIssue({
      code: "custom",
      path: ["nodes"],
      message: "A map must contain exactly one root node.",
    });
  }

  for (const [index, node] of map.nodes.entries()) {
    if (node.parentId === null) continue;
    if (node.parentId === node.id) {
      ctx.addIssue({
        code: "custom",
        path: ["nodes", index, "parentId"],
        message: "A node cannot be its own parent.",
      });
    } else if (!nodeIds.has(node.parentId)) {
      ctx.addIssue({
        code: "custom",
        path: ["nodes", index, "parentId"],
        message: "Parent node does not exist.",
      });
    }
  }

  for (const [index, node] of map.nodes.entries()) {
    const seen = new Set<string>();
    let current: { id: string; parentId: string | null } | undefined = node;
    while (current?.parentId) {
      if (seen.has(current.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["nodes", index, "parentId"],
          message: "Parent chain contains a cycle.",
        });
        break;
      }
      seen.add(current.id);
      current = nodeById.get(current.parentId);
    }
  }

  for (const [index, edge] of map.edges.entries()) {
    if (edgeIds.has(edge.id)) {
      ctx.addIssue({
        code: "custom",
        path: ["edges", index, "id"],
        message: "Relationship ids must be unique.",
      });
    }
    edgeIds.add(edge.id);

    if (edge.source === edge.target) {
      ctx.addIssue({
        code: "custom",
        path: ["edges", index, "target"],
        message: "A relationship cannot point to the same node.",
      });
    }
    if (!nodeIds.has(edge.source)) {
      ctx.addIssue({
        code: "custom",
        path: ["edges", index, "source"],
        message: "Relationship source node does not exist.",
      });
    }
    if (!nodeIds.has(edge.target)) {
      ctx.addIssue({
        code: "custom",
        path: ["edges", index, "target"],
        message: "Relationship target node does not exist.",
      });
    }
  }
});

export const mapMetaSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  participantLabel: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  nodeCount: z.number(),
});

export const mapIndexSchema = z.array(mapMetaSchema);
