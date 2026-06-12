import type { MebsMap, MebsNode, NodeType, ZoneId } from "@/types/graph";
import { buildChildrenMap } from "@/lib/layout";
import { templateByLabel } from "@/lib/templates";

/** Zone for each seeded MEBS domain template. */
const TEMPLATE_ZONE: Record<string, ZoneId> = {
  person: "roots",
  ecology: "roots",
  behaviour: "behaviour",
  formulation: "trunk",
  proactive: "branches",
  skills: "branches",
  response: "branches",
  restrictive: "branches",
  data: "branches",
};

/** Ordered label heuristics for user-created domains; first match wins. */
const LABEL_ZONE_RULES: Array<[RegExp, ZoneId]> = [
  [/formulat|function|hypothes|maintain/i, "trunk"],
  [/behaviou?r|escalat|incident/i, "behaviour"],
  [/quality.?of.?life|good.?life|goal|outcome|particip/i, "canopy"],
  [
    /support|strateg|skill|response|crisis|restrict|safeguard|data|monitor|review|fidelity/i,
    "branches",
  ],
];

/** Which zone a node type argues for when voting on an unlabeled domain. */
const TYPE_ZONE_VOTE: Partial<Record<NodeType, ZoneId>> = {
  behaviour_pattern: "behaviour",
  early_warning_sign: "behaviour",
  setting_event: "trunk",
  antecedent: "trunk",
  consequence: "trunk",
  function_hypothesis: "trunk",
  trauma_factor: "trunk",
  sensory_factor: "trunk",
  health_factor: "trunk",
  communication_factor: "trunk",
  skill_gap: "trunk",
  proactive_support: "branches",
  environmental_strategy: "branches",
  skill_to_build: "branches",
  replacement_behaviour: "branches",
  response_strategy: "branches",
  crisis_strategy: "branches",
  restrictive_practice: "branches",
  safeguard: "branches",
  rights_consideration: "branches",
  data_source: "branches",
  implementation_issue: "branches",
  person_strength: "roots",
  setting: "roots",
  routine: "roots",
  stakeholder: "roots",
  protective_factor: "roots",
  quality_of_life_goal: "canopy",
};

const PROMOTE_LABEL = /goal|good.?life|outcome|aspiration|particip/i;

function typeVote(
  domain: MebsNode,
  childrenOf: Map<string | null, MebsNode[]>
): ZoneId | null {
  const votes = new Map<ZoneId, number>();
  const stack: MebsNode[] = [domain];
  while (stack.length) {
    const cur = stack.pop()!;
    const zone = TYPE_ZONE_VOTE[cur.type];
    if (zone) votes.set(zone, (votes.get(zone) ?? 0) + 1);
    stack.push(...(childrenOf.get(cur.id) ?? []));
  }
  let best: ZoneId | null = null;
  let bestCount = 0;
  for (const [zone, count] of votes) {
    if (count > bestCount) {
      best = zone;
      bestCount = count;
    }
  }
  return best;
}

function zoneForDomain(
  domain: MebsNode,
  childrenOf: Map<string | null, MebsNode[]>
): ZoneId {
  if (domain.mapZone) return domain.mapZone;
  if (domain.templateId && TEMPLATE_ZONE[domain.templateId]) {
    return TEMPLATE_ZONE[domain.templateId];
  }
  const template = templateByLabel(domain.label);
  if (template && TEMPLATE_ZONE[template.id]) return TEMPLATE_ZONE[template.id];
  for (const [re, zone] of LABEL_ZONE_RULES) {
    if (re.test(domain.label)) return zone;
  }
  return typeVote(domain, childrenOf) ?? "roots";
}

/** Should this direct child of a roots-zone domain be promoted to the canopy? */
function promotes(child: MebsNode): boolean {
  if (child.mapZone === "roots") return false; // explicit opt-out
  return (
    child.mapZone === "canopy" ||
    child.type === "quality_of_life_goal" ||
    child.childTypeHint === "quality_of_life_goal" ||
    PROMOTE_LABEL.test(child.label)
  );
}

/** One top-level tree of the visual forest (a domain, or a promoted subtree). */
export interface ZoneTree {
  node: MebsNode;
  zone: ZoneId;
  /** for promoted canopy trees: the roots-zone domain they belong to in the data */
  promotedFrom?: MebsNode;
}

export interface ZoneClassification {
  root: MebsNode | null;
  /** visual top-level trees, grouped by zone, in display order */
  trees: Record<ZoneId, ZoneTree[]>;
  /** zone of every node reachable from the root */
  zoneOf: Map<string, ZoneId>;
  /** ids of promoted subtree roots */
  promotedIds: Set<string>;
  /**
   * Children map of the VISUAL forest: identical to the data tree except that
   * promoted subtrees are detached from their parent. The stored
   * `node.parentId` is never modified — this is render-time only.
   */
  visualChildrenOf: Map<string | null, MebsNode[]>;
}

export function classifyZones(map: Pick<MebsMap, "nodes">): ZoneClassification {
  const childrenOf = buildChildrenMap(map.nodes);
  const root =
    map.nodes.find((n) => n.type === "root" && n.parentId === null) ??
    map.nodes.find((n) => n.parentId === null) ??
    null;

  const trees: Record<ZoneId, ZoneTree[]> = {
    roots: [],
    trunk: [],
    behaviour: [],
    branches: [],
    canopy: [],
  };
  const zoneOf = new Map<string, ZoneId>();
  const promotedIds = new Set<string>();
  const visualChildrenOf = new Map<string | null, MebsNode[]>();
  for (const [parent, kids] of childrenOf) {
    visualChildrenOf.set(parent, [...kids]);
  }
  if (!root) return { root, trees, zoneOf, promotedIds, visualChildrenOf };

  const domains = childrenOf.get(root.id) ?? [];
  const promoted: Array<{ tree: ZoneTree; sort: [number, number] }> = [];

  for (const domain of domains) {
    const zone = zoneForDomain(domain, childrenOf);
    trees[zone].push({ node: domain, zone });
    if (zone !== "roots") continue;
    // QoL promotion: only direct children of roots domains, one level deep.
    for (const child of childrenOf.get(domain.id) ?? []) {
      if (!promotes(child)) continue;
      promotedIds.add(child.id);
      promoted.push({
        tree: { node: child, zone: "canopy", promotedFrom: domain },
        sort: [domain.order, child.order],
      });
      const siblings = visualChildrenOf.get(domain.id) ?? [];
      visualChildrenOf.set(
        domain.id,
        siblings.filter((s) => s.id !== child.id)
      );
    }
  }

  promoted.sort(
    (a, b) => a.sort[0] - b.sort[0] || a.sort[1] - b.sort[1]
  );
  trees.canopy.push(...promoted.map((p) => p.tree));

  // Every node inherits its visual tree's zone (computed on the forest).
  zoneOf.set(root.id, "trunk");
  for (const zone of Object.keys(trees) as ZoneId[]) {
    for (const tree of trees[zone]) {
      const stack: MebsNode[] = [tree.node];
      while (stack.length) {
        const cur = stack.pop()!;
        zoneOf.set(cur.id, zone);
        stack.push(...(visualChildrenOf.get(cur.id) ?? []));
      }
    }
  }

  return { root, trees, zoneOf, promotedIds, visualChildrenOf };
}
