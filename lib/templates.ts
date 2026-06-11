import type { NodeType } from "@/types/graph";

export interface TemplateSuggestion {
  label: string;
  type: NodeType;
  /** default type for items added under this suggested cluster */
  childTypeHint?: NodeType;
}

export interface DomainTemplate {
  id: string;
  label: string;
  purpose: string;
  /** default type for children added directly under the domain */
  childTypeHint: NodeType;
  suggestions: TemplateSuggestion[];
}

/** The nine recommended MEBS domains and their suggested sub-branches (spec §5). */
export const DOMAIN_TEMPLATES: DomainTemplate[] = [
  {
    id: "person",
    label: "Person, Strengths & Quality of Life",
    purpose: "Keep the person, not the behaviour, at the centre.",
    childTypeHint: "person_strength",
    suggestions: [
      { label: "Strengths", type: "domain", childTypeHint: "person_strength" },
      { label: "Interests", type: "domain", childTypeHint: "person_strength" },
      { label: "Preferred routines", type: "domain", childTypeHint: "routine" },
      { label: "Important relationships", type: "domain", childTypeHint: "stakeholder" },
      { label: "Communication preferences", type: "domain", childTypeHint: "communication_factor" },
      { label: "Cultural identity", type: "domain", childTypeHint: "person_strength" },
      { label: "Personal goals", type: "domain", childTypeHint: "quality_of_life_goal" },
      { label: "Good-life outcomes", type: "domain", childTypeHint: "quality_of_life_goal" },
      { label: "Participation goals", type: "domain", childTypeHint: "quality_of_life_goal" },
    ],
  },
  {
    id: "ecology",
    label: "Ecology, Routines & Context",
    purpose: "Map the environments and systems around the participant.",
    childTypeHint: "setting",
    suggestions: [
      { label: "Home", type: "setting", childTypeHint: "routine" },
      { label: "School / day program / work", type: "setting", childTypeHint: "routine" },
      { label: "Community", type: "setting", childTypeHint: "routine" },
      { label: "Support team", type: "domain", childTypeHint: "stakeholder" },
      { label: "Family system", type: "domain", childTypeHint: "stakeholder" },
      { label: "Service system", type: "domain", childTypeHint: "stakeholder" },
      { label: "Daily routines", type: "domain", childTypeHint: "routine" },
      { label: "Predictability", type: "domain", childTypeHint: "environmental_strategy" },
      { label: "Choice and control", type: "domain", childTypeHint: "environmental_strategy" },
      { label: "Environmental stressors", type: "domain", childTypeHint: "setting_event" },
      { label: "System constraints", type: "domain", childTypeHint: "implementation_issue" },
    ],
  },
  {
    id: "behaviour",
    label: "Behaviour Patterns & Escalation Cycle",
    purpose: "Describe observable patterns without over-interpreting them.",
    childTypeHint: "behaviour_pattern",
    suggestions: [
      { label: "Behaviours of concern", type: "domain", childTypeHint: "behaviour_pattern" },
      { label: "Early warning signs", type: "domain", childTypeHint: "early_warning_sign" },
      { label: "Low-level distress signs", type: "domain", childTypeHint: "early_warning_sign" },
      { label: "Escalation sequence", type: "domain", childTypeHint: "behaviour_pattern" },
      { label: "Peak-risk behaviours", type: "domain", childTypeHint: "behaviour_pattern" },
      { label: "Recovery signs", type: "domain", childTypeHint: "early_warning_sign" },
      { label: "Post-incident patterns", type: "domain", childTypeHint: "behaviour_pattern" },
      { label: "Frequency / intensity / duration", type: "domain", childTypeHint: "data_source" },
      { label: "Known high-risk contexts", type: "domain", childTypeHint: "setting" },
    ],
  },
  {
    id: "formulation",
    label: "Formulation & Maintaining Variables",
    purpose: "Organise hypotheses about why behaviours occur.",
    childTypeHint: "function_hypothesis",
    suggestions: [
      { label: "Setting events", type: "domain", childTypeHint: "setting_event" },
      { label: "Antecedents", type: "domain", childTypeHint: "antecedent" },
      { label: "Consequences", type: "domain", childTypeHint: "consequence" },
      { label: "Function hypotheses", type: "domain", childTypeHint: "function_hypothesis" },
      { label: "Trauma considerations", type: "domain", childTypeHint: "trauma_factor" },
      { label: "Sensory considerations", type: "domain", childTypeHint: "sensory_factor" },
      { label: "Health and sleep factors", type: "domain", childTypeHint: "health_factor" },
      { label: "Communication breakdowns", type: "domain", childTypeHint: "communication_factor" },
      { label: "Skill gaps", type: "domain", childTypeHint: "skill_gap" },
      { label: "Protective factors", type: "domain", childTypeHint: "protective_factor" },
      { label: "Unknowns requiring assessment", type: "domain", childTypeHint: "open_question" },
    ],
  },
  {
    id: "proactive",
    label: "Proactive & Environmental Supports",
    purpose: "Show how the environment should change.",
    childTypeHint: "proactive_support",
    suggestions: [
      { label: "Predictable routines", type: "domain", childTypeHint: "proactive_support" },
      { label: "Choice architecture", type: "domain", childTypeHint: "proactive_support" },
      { label: "Demand modification", type: "domain", childTypeHint: "proactive_support" },
      { label: "Communication supports", type: "domain", childTypeHint: "proactive_support" },
      { label: "Visual supports", type: "domain", childTypeHint: "proactive_support" },
      { label: "Rapport & relationship strategies", type: "domain", childTypeHint: "proactive_support" },
      { label: "Regulation supports", type: "domain", childTypeHint: "proactive_support" },
      { label: "Health-related supports", type: "domain", childTypeHint: "proactive_support" },
      { label: "Cultural safety", type: "domain", childTypeHint: "proactive_support" },
      { label: "Participation supports", type: "domain", childTypeHint: "proactive_support" },
    ],
  },
  {
    id: "skills",
    label: "Skill Acquisition & Replacement Behaviours",
    purpose: "Show constructional support, not just behaviour reduction.",
    childTypeHint: "skill_to_build",
    suggestions: [
      { label: "Functional communication", type: "domain", childTypeHint: "replacement_behaviour" },
      { label: "Self-advocacy", type: "domain", childTypeHint: "skill_to_build" },
      { label: "Emotional regulation", type: "domain", childTypeHint: "skill_to_build" },
      { label: "Transition skills", type: "domain", childTypeHint: "skill_to_build" },
      { label: "Waiting / tolerance skills", type: "domain", childTypeHint: "skill_to_build" },
      { label: "Choice-making", type: "domain", childTypeHint: "skill_to_build" },
      { label: "Problem-solving", type: "domain", childTypeHint: "skill_to_build" },
      { label: "Health and self-care", type: "domain", childTypeHint: "skill_to_build" },
      { label: "Social connection", type: "domain", childTypeHint: "skill_to_build" },
      { label: "Community participation", type: "domain", childTypeHint: "skill_to_build" },
      { label: "Independence skills", type: "domain", childTypeHint: "skill_to_build" },
    ],
  },
  {
    id: "response",
    label: "Response Strategies & Crisis Support",
    purpose: "Show what supporters do across the escalation cycle.",
    childTypeHint: "response_strategy",
    suggestions: [
      { label: "Baseline support", type: "domain", childTypeHint: "response_strategy" },
      { label: "Early warning response", type: "domain", childTypeHint: "response_strategy" },
      { label: "Escalation response", type: "domain", childTypeHint: "response_strategy" },
      { label: "Crisis response", type: "domain", childTypeHint: "crisis_strategy" },
      { label: "Post-crisis repair", type: "domain", childTypeHint: "response_strategy" },
      { label: "Debrief process", type: "domain", childTypeHint: "response_strategy" },
      { label: "Data collection after incidents", type: "domain", childTypeHint: "data_source" },
      { label: "When to seek emergency support", type: "domain", childTypeHint: "crisis_strategy" },
    ],
  },
  {
    id: "restrictive",
    label: "Restrictive Practices, Safeguards & Rights",
    purpose: "Prevent restrictive practices being hidden inside general strategies.",
    childTypeHint: "restrictive_practice",
    suggestions: [
      { label: "Current restrictive practices", type: "domain", childTypeHint: "restrictive_practice" },
      { label: "Proposed restrictive practices", type: "domain", childTypeHint: "restrictive_practice" },
      { label: "Authorisation status", type: "domain", childTypeHint: "safeguard" },
      { label: "Consent and consultation", type: "domain", childTypeHint: "safeguard" },
      { label: "Human rights rationale", type: "domain", childTypeHint: "rights_consideration" },
      { label: "Least restrictive alternatives", type: "domain", childTypeHint: "proactive_support" },
      { label: "Fading plan", type: "domain", childTypeHint: "safeguard" },
      { label: "Monitoring requirements", type: "domain", childTypeHint: "safeguard" },
      { label: "Review dates", type: "domain", childTypeHint: "safeguard" },
      { label: "Safeguards", type: "domain", childTypeHint: "safeguard" },
      { label: "Risks of misuse", type: "domain", childTypeHint: "rights_consideration" },
    ],
  },
  {
    id: "data",
    label: "Data, Fidelity & Review",
    purpose: "Make the plan testable.",
    childTypeHint: "data_source",
    suggestions: [
      { label: "Baseline data", type: "domain", childTypeHint: "data_source" },
      { label: "Behaviour data", type: "domain", childTypeHint: "data_source" },
      { label: "Quality-of-life data", type: "domain", childTypeHint: "data_source" },
      { label: "Implementation fidelity", type: "domain", childTypeHint: "implementation_issue" },
      { label: "Skill acquisition data", type: "domain", childTypeHint: "data_source" },
      { label: "Incident review", type: "domain", childTypeHint: "data_source" },
      { label: "Medication / health review", type: "domain", childTypeHint: "health_factor" },
      { label: "Team training needs", type: "domain", childTypeHint: "implementation_issue" },
      { label: "Open questions", type: "domain", childTypeHint: "open_question" },
      { label: "Next review priorities", type: "domain", childTypeHint: "open_question" },
    ],
  },
];

export const ROOT_LABEL =
  "Participant: Good Life, Behaviour Formulation & Support Map";

export function templateById(id: string | undefined) {
  if (!id) return undefined;
  return DOMAIN_TEMPLATES.find((t) => t.id === id);
}

export function templateByLabel(label: string) {
  const norm = label.trim().toLowerCase();
  return DOMAIN_TEMPLATES.find((t) => t.label.toLowerCase() === norm);
}
