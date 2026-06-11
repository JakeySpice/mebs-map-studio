import {
  EDGE_TYPE_LABELS,
  NODE_TYPE_INFO,
  type MebsMap,
  type MebsNode,
} from "@/types/graph";
import { buildChildrenMap } from "@/lib/layout";

/** Renders the full map (ignoring collapse state) as a formulation summary. */
export function exportMarkdown(map: MebsMap): string {
  const childrenOf = buildChildrenMap(map.nodes);
  const root = map.nodes.find((n) => n.parentId === null);
  const lines: string[] = [];

  lines.push(`# ${map.title}`);
  lines.push("");
  if (map.participantLabel) {
    lines.push(`**Participant:** ${map.participantLabel}  `);
  }
  lines.push(`**Framework:** MEBS  `);
  lines.push(`**Exported:** ${new Date().toLocaleString()}`);
  lines.push("");
  lines.push(
    "> Working formulation map created in MEBS Map Studio. " +
      "This is a thinking tool, not a finalised Behaviour Support Plan."
  );
  lines.push("");

  const renderItem = (node: MebsNode, indent: number) => {
    const pad = "  ".repeat(indent);
    const typeLabel =
      node.type === "domain" ? "" : ` _(${NODE_TYPE_INFO[node.type].label})_`;
    const summary = node.summary?.trim() ? ` - ${node.summary.trim()}` : "";
    lines.push(`${pad}- **${node.label}**${typeLabel}${summary}`);
    if (node.details?.trim()) {
      for (const detailLine of node.details.trim().split(/\r?\n/)) {
        lines.push(`${pad}  - _${detailLine}_`);
      }
    }
    for (const child of childrenOf.get(node.id) ?? []) {
      renderItem(child, indent + 1);
    }
  };

  for (const domain of childrenOf.get(root?.id ?? "") ?? []) {
    lines.push(`## ${domain.label}`);
    if (domain.summary?.trim()) {
      lines.push("");
      lines.push(`_${domain.summary.trim()}_`);
    }
    lines.push("");
    const kids = childrenOf.get(domain.id) ?? [];
    if (kids.length === 0) {
      lines.push("- _Not yet mapped._");
    } else {
      for (const child of kids) renderItem(child, 0);
    }
    lines.push("");
  }

  if (map.edges.length > 0) {
    lines.push(`## Relationships`);
    lines.push("");
    const byId = new Map(map.nodes.map((n) => [n.id, n]));
    for (const edge of map.edges) {
      const source = byId.get(edge.source)?.label ?? "?";
      const target = byId.get(edge.target)?.label ?? "?";
      const label = edge.label?.trim()
        ? edge.label.trim()
        : EDGE_TYPE_LABELS[edge.type];
      const notes = edge.notes?.trim() ? ` - ${edge.notes.trim()}` : "";
      lines.push(`- **${source}** - *${label}* -> **${target}**${notes}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
