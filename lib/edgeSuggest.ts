import type { EdgeType, NodeType } from "@/types/graph";

/**
 * Suggest a clinically sensible default relationship type for a
 * source → target node-type pair. Pure lookup, first matching rule wins —
 * a convenience default the practitioner can always override, never an
 * inference about the actual case.
 */

const BEHAVIOUR: NodeType[] = ["behaviour_pattern"];
const VULNERABILITY: NodeType[] = [
  "trauma_factor",
  "sensory_factor",
  "health_factor",
  "communication_factor",
  "skill_gap",
];
const SUPPORT: NodeType[] = [
  "proactive_support",
  "environmental_strategy",
  "response_strategy",
  "crisis_strategy",
  "safeguard",
  "protective_factor",
];
const SKILL: NodeType[] = ["skill_to_build", "replacement_behaviour"];
const RISK_CONTEXT: NodeType[] = [...VULNERABILITY, "setting_event", "antecedent"];

interface Rule {
  source?: NodeType[];
  target?: NodeType[];
  type: EdgeType;
}

const RULES: Rule[] = [
  // aspirations: anything pointed at quality of life builds toward it
  { target: ["quality_of_life_goal"], type: "builds_toward" },
  // constructional core: skills replace behaviours of concern
  { source: SKILL, target: BEHAVIOUR, type: "is_replacement_for" },
  // supports and protective factors reduce risk of behaviour / its context
  { source: SUPPORT, target: [...BEHAVIOUR, "early_warning_sign", ...RISK_CONTEXT], type: "reduces_risk_of" },
  // least restrictive alternatives to restrictive practices
  { source: [...SUPPORT, ...SKILL], target: ["restrictive_practice"], type: "is_alternative_to" },
  // restrictive practices demand safeguards / rights scrutiny
  { source: ["restrictive_practice"], target: ["safeguard", "rights_consideration"], type: "requires_safeguard" },
  // formulation chain
  { source: ["antecedent"], target: BEHAVIOUR, type: "evokes" },
  { source: ["setting_event"], target: [...BEHAVIOUR, "antecedent"], type: "sets_the_occasion_for" },
  { source: VULNERABILITY, target: [...BEHAVIOUR, "setting_event"], type: "contributes_to" },
  { source: ["early_warning_sign"], target: BEHAVIOUR, type: "indicates" },
  { source: BEHAVIOUR, target: ["consequence"], type: "leads_to" },
  { source: BEHAVIOUR, target: ["function_hypothesis", "communication_factor"], type: "communicates" },
  { source: ["consequence"], target: ["function_hypothesis"], type: "supports" },
  // hypotheses and behaviours are addressed by the support plan
  { source: [...BEHAVIOUR, "function_hypothesis"], target: [...SUPPORT, ...SKILL], type: "addressed_by" },
  // measurement and open questions (only the direction that reads correctly:
  // "X is measured by <data>", "<question> needs data about X")
  { target: ["data_source"], type: "is_measured_by" },
  { source: ["open_question"], type: "needs_data_about" },
];

export function suggestEdgeType(source: NodeType, target: NodeType): EdgeType {
  for (const rule of RULES) {
    if (rule.source && !rule.source.includes(source)) continue;
    if (rule.target && !rule.target.includes(target)) continue;
    return rule.type;
  }
  return "contributes_to";
}
