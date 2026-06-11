export type NodeType =
  | "root"
  | "domain"
  | "person_strength"
  | "quality_of_life_goal"
  | "setting"
  | "routine"
  | "stakeholder"
  | "behaviour_pattern"
  | "early_warning_sign"
  | "setting_event"
  | "antecedent"
  | "consequence"
  | "function_hypothesis"
  | "trauma_factor"
  | "sensory_factor"
  | "health_factor"
  | "communication_factor"
  | "skill_gap"
  | "protective_factor"
  | "proactive_support"
  | "environmental_strategy"
  | "skill_to_build"
  | "replacement_behaviour"
  | "response_strategy"
  | "crisis_strategy"
  | "restrictive_practice"
  | "safeguard"
  | "rights_consideration"
  | "data_source"
  | "implementation_issue"
  | "open_question";

export type EdgeType =
  | "contributes_to"
  | "sets_the_occasion_for"
  | "evokes"
  | "maintained_by"
  | "communicates"
  | "indicates"
  | "reduces_risk_of"
  | "increases_risk_of"
  | "supports"
  | "requires"
  | "requires_safeguard"
  | "is_alternative_to"
  | "is_replacement_for"
  | "is_measured_by"
  | "needs_data_about"
  | "is_reviewed_by";

/** Pastel visual groupings, used semantically (spec §18). */
export type VisualGroup =
  | "lavender"
  | "blue"
  | "mint"
  | "rose"
  | "amber"
  | "yellow"
  | "slate";

export interface MebsNode {
  id: string;
  type: NodeType;
  label: string;
  summary?: string;
  details?: string;
  /** null only for the root node */
  parentId: string | null;
  /** sibling sort order */
  order: number;
  collapsed: boolean;
  /** default NodeType for children added under this node */
  childTypeHint?: NodeType;
  /** links a seeded domain back to its template for quick-add suggestions */
  templateId?: string;
}

/** Cross-link (clinical relationship). Tree structure lives in MebsNode.parentId. */
export interface MebsEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  /** optional custom label overriding the type label */
  label?: string;
  notes?: string;
}

export interface MebsMap {
  id: string;
  title: string;
  participantLabel: string;
  framework: "MEBS";
  version: string;
  createdAt: string;
  updatedAt: string;
  nodes: MebsNode[];
  edges: MebsEdge[];
}

export interface MapMeta {
  id: string;
  title: string;
  participantLabel: string;
  createdAt: string;
  updatedAt: string;
  nodeCount: number;
}

export const NODE_TYPE_INFO: Record<
  NodeType,
  { label: string; group: VisualGroup }
> = {
  root: { label: "Root", group: "lavender" },
  domain: { label: "Domain / cluster", group: "blue" },
  person_strength: { label: "Strength", group: "mint" },
  quality_of_life_goal: { label: "Quality-of-life goal", group: "mint" },
  setting: { label: "Setting", group: "slate" },
  routine: { label: "Routine", group: "slate" },
  stakeholder: { label: "Stakeholder", group: "slate" },
  behaviour_pattern: { label: "Behaviour pattern", group: "rose" },
  early_warning_sign: { label: "Early warning sign", group: "amber" },
  setting_event: { label: "Setting event", group: "amber" },
  antecedent: { label: "Antecedent", group: "amber" },
  consequence: { label: "Consequence", group: "amber" },
  function_hypothesis: { label: "Function hypothesis", group: "amber" },
  trauma_factor: { label: "Trauma factor", group: "amber" },
  sensory_factor: { label: "Sensory factor", group: "amber" },
  health_factor: { label: "Health factor", group: "amber" },
  communication_factor: { label: "Communication factor", group: "amber" },
  skill_gap: { label: "Skill gap", group: "amber" },
  protective_factor: { label: "Protective factor", group: "mint" },
  proactive_support: { label: "Proactive support", group: "mint" },
  environmental_strategy: { label: "Environmental strategy", group: "mint" },
  skill_to_build: { label: "Skill to build", group: "mint" },
  replacement_behaviour: { label: "Replacement behaviour", group: "mint" },
  response_strategy: { label: "Response strategy", group: "mint" },
  crisis_strategy: { label: "Crisis strategy", group: "mint" },
  restrictive_practice: { label: "Restrictive practice", group: "rose" },
  safeguard: { label: "Safeguard", group: "mint" },
  rights_consideration: { label: "Rights consideration", group: "mint" },
  data_source: { label: "Data source", group: "yellow" },
  implementation_issue: { label: "Implementation issue", group: "yellow" },
  open_question: { label: "Open question", group: "yellow" },
};

export const ALL_NODE_TYPES = Object.keys(NODE_TYPE_INFO) as NodeType[];

export const EDGE_TYPE_LABELS: Record<EdgeType, string> = {
  contributes_to: "contributes to",
  sets_the_occasion_for: "sets the occasion for",
  evokes: "evokes",
  maintained_by: "maintained by",
  communicates: "communicates",
  indicates: "indicates",
  reduces_risk_of: "reduces risk of",
  increases_risk_of: "increases risk of",
  supports: "supports",
  requires: "requires",
  requires_safeguard: "requires safeguard",
  is_alternative_to: "is alternative to",
  is_replacement_for: "is replacement for",
  is_measured_by: "is measured by",
  needs_data_about: "needs data about",
  is_reviewed_by: "is reviewed by",
};

export const ALL_EDGE_TYPES = Object.keys(EDGE_TYPE_LABELS) as EdgeType[];

export function edgeDisplayLabel(edge: MebsEdge): string {
  return edge.label?.trim() ? edge.label : EDGE_TYPE_LABELS[edge.type];
}

/** Pastel fills with a slightly stronger border, tuned for a dark canvas. */
export const GROUP_COLORS: Record<
  VisualGroup,
  { bg: string; border: string; chip: string }
> = {
  lavender: { bg: "#cfc5f4", border: "#a995ec", chip: "#b8a9ef" },
  blue: { bg: "#b9d2f2", border: "#8fb4e9", chip: "#a3c2ee" },
  mint: { bg: "#bce4cd", border: "#8fd0ac", chip: "#a5dabc" },
  rose: { bg: "#f2c0cb", border: "#e596a8", chip: "#ecabb9" },
  amber: { bg: "#f4d6a6", border: "#e9b96e", chip: "#efc88a" },
  yellow: { bg: "#efe5ab", border: "#ddcc72", chip: "#e6d88e" },
  slate: { bg: "#ccd5e2", border: "#a8b7cd", chip: "#bac6d7" },
};

export function nodeColors(type: NodeType) {
  return GROUP_COLORS[NODE_TYPE_INFO[type].group];
}
