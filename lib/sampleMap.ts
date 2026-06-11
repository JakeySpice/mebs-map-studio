import type {
  EdgeType,
  MebsEdge,
  MebsMap,
  MebsNode,
  NodeType,
} from "@/types/graph";

/**
 * A fully de-identified demonstration case ("Jordan", a pseudonym), based on
 * the worked example in the project spec: a young person whose aggression
 * clusters around transitions, writing demands and being talked over, with
 * poor sleep as a recurring setting event.
 */
export function buildSampleMap(): Omit<
  MebsMap,
  "id" | "createdAt" | "updatedAt"
> {
  const nodes: MebsNode[] = [];
  const orders = new Map<string | null, number>();

  const n = (
    id: string,
    parentId: string | null,
    type: NodeType,
    label: string,
    extra?: Partial<MebsNode>
  ): string => {
    const order = orders.get(parentId) ?? 0;
    orders.set(parentId, order + 1);
    nodes.push({
      id,
      parentId,
      type,
      label,
      order,
      collapsed: false,
      ...extra,
    });
    return id;
  };

  const edges: MebsEdge[] = [];
  const e = (
    id: string,
    source: string,
    target: string,
    type: EdgeType,
    notes?: string
  ) => {
    edges.push({ id, source, target, type, notes });
  };

  // ---- root ------------------------------------------------------------
  const root = n(
    "root",
    null,
    "root",
    "Jordan: Good Life, Behaviour Formulation & Support Map"
  );

  // ---- 1. Person, strengths & quality of life ---------------------------
  const person = n("person", root, "domain", "Person, Strengths & Quality of Life", {
    collapsed: true,
    templateId: "person",
    childTypeHint: "person_strength",
    summary: "Keep the person, not the behaviour, at the centre.",
  });
  const strengths = n("strengths", person, "domain", "Strengths", {
    collapsed: true,
    childTypeHint: "person_strength",
  });
  n("s-funny", strengths, "person_strength", "Funny and sociable", {
    summary: "Quick wit; uses humour to connect with adults he trusts.",
  });
  n("s-helping", strengths, "person_strength", "Loves helping younger kids", {
    summary: "Volunteers with the Year 3 reading group; patient and proud of it.",
  });
  n("s-fairness", strengths, "person_strength", "Strong sense of fairness");
  const interests = n("interests", person, "domain", "Interests", {
    collapsed: true,
    childTypeHint: "person_strength",
  });
  n("i-basketball", interests, "person_strength", "Basketball at lunch");
  n("i-minecraft", interests, "person_strength", "Minecraft building servers");
  const relationships = n("relationships", person, "domain", "Important relationships", {
    collapsed: true,
    childTypeHint: "stakeholder",
  });
  n("r-mum", relationships, "stakeholder", "Mum (primary carer)");
  n("r-cousins", relationships, "stakeholder", "Younger cousins on weekends");
  n("r-pe", relationships, "stakeholder", "PE teacher (strong rapport)");
  const commPrefs = n("comm-prefs", person, "domain", "Communication preferences", {
    collapsed: true,
    childTypeHint: "communication_factor",
  });
  n("cp-time", commPrefs, "communication_factor", "Needs processing time before responding");
  n("cp-one", commPrefs, "communication_factor", "One instruction at a time works best");
  const goals = n("goals", person, "domain", "Personal goals", {
    collapsed: true,
    childTypeHint: "quality_of_life_goal",
  });
  n("g-control", goals, "quality_of_life_goal", "More say in his daily routine");
  n("g-mentor", goals, "quality_of_life_goal", "Keep the Year 3 mentoring role", {
    summary: "Identified by Jordan as the best part of his week.",
  });

  // ---- 2. Ecology, routines & context -----------------------------------
  const ecology = n("ecology", root, "domain", "Ecology, Routines & Context", {
    collapsed: true,
    templateId: "ecology",
    childTypeHint: "setting",
    summary: "Map the environments and systems around the participant.",
  });
  const home = n("home", ecology, "setting", "Home", {
    collapsed: true,
    childTypeHint: "routine",
  });
  n("h-mum", home, "routine", "Lives with Mum; quiet weeknights");
  n("h-gaming", home, "routine", "Late-night gaming on school nights");
  const school = n("school", ecology, "setting", "School (Year 7, mainstream)", {
    collapsed: true,
    childTypeHint: "routine",
  });
  n("sc-writing", school, "routine", "Writing-heavy morning blocks");
  n("sc-sso", school, "stakeholder", "New SSO this term (still building trust)");
  const routines = n("routines", ecology, "domain", "Daily routines", {
    collapsed: true,
    childTypeHint: "routine",
  });
  n("rt-morning", routines, "routine", "Rushed school mornings", {
    summary: "Often leaves without breakfast after late nights.",
  });
  const predict = n("predict", ecology, "domain", "Predictability", {
    collapsed: true,
    childTypeHint: "environmental_strategy",
  });
  n("pr-changes", predict, "setting_event", "Unannounced timetable changes");
  const choice = n("choice", ecology, "domain", "Choice and control", {
    collapsed: true,
    childTypeHint: "environmental_strategy",
  });
  n("ch-few", choice, "setting_event", "Few genuine choices across the school day");

  // ---- 3. Behaviour patterns & escalation cycle --------------------------
  const behaviour = n("behaviour", root, "domain", "Behaviour Patterns & Escalation Cycle", {
    collapsed: true,
    templateId: "behaviour",
    childTypeHint: "behaviour_pattern",
    summary: "Describe observable patterns without over-interpreting them.",
  });
  const boc = n("boc", behaviour, "domain", "Behaviours of concern", {
    collapsed: true,
    childTypeHint: "behaviour_pattern",
  });
  n("b-verbal", boc, "behaviour_pattern", "Verbal aggression (shouting, threats)", {
    summary: "Most days during transitions; directed at adults.",
  });
  n("b-property", boc, "behaviour_pattern", "Throwing materials / property damage", {
    summary: "Roughly weekly; usually during writing tasks.",
  });
  n("b-refusal", boc, "behaviour_pattern", "Transition refusal (won't leave room)", {
    summary: "Sits with hood up and refuses to move between classes.",
  });
  const warning = n("warning", behaviour, "domain", "Early warning signs", {
    collapsed: true,
    childTypeHint: "early_warning_sign",
  });
  n("w-pacing", warning, "early_warning_sign", "Pacing at the back of the room");
  n("w-hood", warning, "early_warning_sign", "Hood up, head down");
  n("w-short", warning, "early_warning_sign", "One-word answers");
  const escalation = n("escalation", behaviour, "domain", "Escalation sequence", {
    collapsed: true,
    childTypeHint: "behaviour_pattern",
  });
  n("e-seq", escalation, "behaviour_pattern", "Warning signs → arguing → shouting → throwing", {
    summary: "Window between warning signs and shouting is 2–10 minutes.",
  });
  const recovery = n("recovery", behaviour, "domain", "Recovery signs", {
    collapsed: true,
    childTypeHint: "early_warning_sign",
  });
  n("rc-quiet", recovery, "early_warning_sign", "Accepts a quiet space without talking");
  const contexts = n("contexts", behaviour, "domain", "Known high-risk contexts", {
    collapsed: true,
    childTypeHint: "setting",
  });
  n("hr-transitions", contexts, "setting", "Transitions between classes");
  n("hr-writing", contexts, "setting", "Writing tasks, especially unsupported");
  n("hr-talkedover", contexts, "setting", "Adults talking over him");

  // ---- 4. Formulation & maintaining variables ----------------------------
  const formulation = n("formulation", root, "domain", "Formulation & Maintaining Variables", {
    collapsed: true,
    templateId: "formulation",
    childTypeHint: "function_hypothesis",
    summary: "Organise hypotheses about why behaviours occur.",
  });
  const settingEvents = n("setting-events", formulation, "domain", "Setting events", {
    collapsed: true,
    childTypeHint: "setting_event",
  });
  n("se-sleep", settingEvents, "setting_event", "Poor sleep (4–5 hours before school days)", {
    summary: "Mum reports late-night gaming; not yet clear if gaming or worry drives it.",
  });
  n("se-breakfast", settingEvents, "setting_event", "Skipped breakfast");
  n("se-conflict", settingEvents, "setting_event", "Morning conflict at home about getting ready");
  const antecedents = n("antecedents", formulation, "domain", "Antecedents", {
    collapsed: true,
    childTypeHint: "antecedent",
  });
  n("a-writing", antecedents, "antecedent", "Writing task presented without support");
  n("a-talkover", antecedents, "antecedent", "Adults talking over or about him");
  n("a-abrupt", antecedents, "antecedent", "Abrupt 'time to move' instructions");
  const consequences = n("consequences", formulation, "domain", "Consequences", {
    collapsed: true,
    childTypeHint: "consequence",
  });
  n("c-removed", consequences, "consequence", "Task removed or shortened");
  n("c-sentout", consequences, "consequence", "Sent out of class (escape from demand)");
  n("c-attention", consequences, "consequence", "One-to-one adult attention after incidents");
  const functions = n("functions", formulation, "domain", "Function hypotheses", {
    collapsed: true,
    childTypeHint: "function_hypothesis",
  });
  n("f-escape", functions, "function_hypothesis", "Escape from writing demands", {
    summary: "Behaviour reliably ends the task; strongest current hypothesis.",
  });
  n("f-control", functions, "function_hypothesis", "Restoring control and predictability", {
    summary: "Aggression clusters where control is lowest: transitions, surprises.",
  });
  const commBreak = n("comm-break", formulation, "domain", "Communication breakdowns", {
    collapsed: true,
    childTypeHint: "communication_factor",
  });
  n("cb-fast", commBreak, "communication_factor", "Instructions delivered too fast to process");
  const skillGaps = n("skill-gaps", formulation, "domain", "Skill gaps", {
    collapsed: true,
    childTypeHint: "skill_gap",
  });
  n("sg-break", skillGaps, "skill_gap", "No reliable way to ask for a break");
  n("sg-negotiate", skillGaps, "skill_gap", "Negotiating task changes calmly");
  const protective = n("protective", formulation, "domain", "Protective factors", {
    collapsed: true,
    childTypeHint: "protective_factor",
  });
  n("pf-pe", protective, "protective_factor", "Strong rapport with PE teacher");
  n("pf-mentor", protective, "protective_factor", "Mentoring role with younger kids");
  const unknowns = n("unknowns", formulation, "domain", "Unknowns requiring assessment", {
    collapsed: true,
    childTypeHint: "open_question",
  });
  n("u-writing", unknowns, "open_question", "Is writing aversive due to motor skills or fear of failure?");
  n("u-sleep", unknowns, "open_question", "Is poor sleep driven by gaming, anxiety, or both?");

  // ---- 5. Proactive & environmental supports -----------------------------
  const proactive = n("proactive", root, "domain", "Proactive & Environmental Supports", {
    collapsed: true,
    templateId: "proactive",
    childTypeHint: "proactive_support",
    summary: "Show how the environment should change.",
  });
  const predictable = n("predictable", proactive, "domain", "Predictable routines", {
    collapsed: true,
    childTypeHint: "proactive_support",
  });
  n("ps-timetable", predictable, "proactive_support", "Visual timetable checked each morning");
  n("ps-warnings", predictable, "proactive_support", "5-minute and 1-minute transition warnings");
  const demand = n("demand", proactive, "domain", "Demand modification", {
    collapsed: true,
    childTypeHint: "proactive_support",
  });
  n("dm-chunk", demand, "proactive_support", "Writing tasks chunked with clear endpoints");
  n("dm-scribe", demand, "proactive_support", "Scribe or speech-to-text options");
  const choiceArch = n("choice-arch", proactive, "domain", "Choice architecture", {
    collapsed: true,
    childTypeHint: "proactive_support",
  });
  n("ca-order", choiceArch, "proactive_support", "Choice of task order within lessons");
  const commSupports = n("comm-supports", proactive, "domain", "Communication supports", {
    collapsed: true,
    childTypeHint: "proactive_support",
  });
  n("cs-breakcard", commSupports, "proactive_support", "Break card honoured immediately");
  n("cs-onevoice", commSupports, "proactive_support", "One adult speaks at a time agreement");
  const regulation = n("regulation", proactive, "domain", "Regulation supports", {
    collapsed: true,
    childTypeHint: "proactive_support",
  });
  n("rs-movement", regulation, "proactive_support", "Scheduled movement breaks mid-morning");

  // ---- 6. Skill acquisition & replacement behaviours ---------------------
  const skills = n("skills", root, "domain", "Skill Acquisition & Replacement Behaviours", {
    collapsed: true,
    templateId: "skills",
    childTypeHint: "skill_to_build",
    summary: "Show constructional support, not just behaviour reduction.",
  });
  const fct = n("fct", skills, "domain", "Functional communication", {
    collapsed: true,
    childTypeHint: "replacement_behaviour",
  });
  n("fc-break", fct, "replacement_behaviour", "Requesting a break (card or phrase)", {
    summary: "Replacement for escape-maintained aggression.",
  });
  n("fc-help", fct, "replacement_behaviour", "Asking for help with writing");
  const advocacy = n("advocacy", skills, "domain", "Self-advocacy", {
    collapsed: true,
    childTypeHint: "skill_to_build",
  });
  n("sa-voice", advocacy, "skill_to_build", "Voicing preferences in planning meetings");
  const regSkills = n("reg-skills", skills, "domain", "Emotional regulation", {
    collapsed: true,
    childTypeHint: "skill_to_build",
  });
  n("er-notice", regSkills, "skill_to_build", "Noticing his own early warning signs");
  const transSkills = n("trans-skills", skills, "domain", "Transition skills", {
    collapsed: true,
    childTypeHint: "skill_to_build",
  });
  n("ts-timer", transSkills, "skill_to_build", "Using countdown timers to self-pace transitions");

  // ---- 7. Response strategies & crisis support ---------------------------
  const response = n("response", root, "domain", "Response Strategies & Crisis Support", {
    collapsed: true,
    templateId: "response",
    childTypeHint: "response_strategy",
    summary: "Show what supporters do across the escalation cycle.",
  });
  const baseline = n("baseline", response, "domain", "Baseline support", {
    collapsed: true,
    childTypeHint: "response_strategy",
  });
  n("bl-attention", baseline, "response_strategy", "Frequent low-key positive attention");
  const earlyResp = n("early-resp", response, "domain", "Early warning response", {
    collapsed: true,
    childTypeHint: "response_strategy",
  });
  n("ew-reduce", earlyResp, "response_strategy", "Quietly reduce demands; offer the break card");
  n("ew-move", earlyResp, "response_strategy", "Offer a movement break or errand");
  const escResp = n("esc-resp", response, "domain", "Escalation response", {
    collapsed: true,
    childTypeHint: "response_strategy",
  });
  n("es-space", escResp, "response_strategy", "Give space; stop new demands");
  n("es-onevoice", escResp, "response_strategy", "One adult speaks, calmly and briefly");
  const crisis = n("crisis", response, "domain", "Crisis response", {
    collapsed: true,
    childTypeHint: "crisis_strategy",
  });
  n("cr-clear", crisis, "crisis_strategy", "Move others away rather than moving Jordan");
  n("cr-plan", crisis, "crisis_strategy", "Follow the school safety plan; no physical intervention");
  const repair = n("repair", response, "domain", "Post-crisis repair", {
    collapsed: true,
    childTypeHint: "response_strategy",
  });
  n("pr-reconnect", repair, "response_strategy", "Reconnect first; debrief later, if at all that day");

  // ---- 8. Restrictive practices, safeguards & rights ----------------------
  const restrictive = n("restrictive", root, "domain", "Restrictive Practices, Safeguards & Rights", {
    collapsed: true,
    templateId: "restrictive",
    childTypeHint: "restrictive_practice",
    summary: "Prevent restrictive practices being hidden inside general strategies.",
  });
  const current = n("current-rp", restrictive, "domain", "Current restrictive practices", {
    collapsed: true,
    childTypeHint: "restrictive_practice",
  });
  n("rp-none", current, "restrictive_practice", "None in place — keep it that way", {
    summary: "Watch that informal seclusion ('sent out of class') does not drift into practice.",
  });
  const safeguards = n("safeguards", restrictive, "domain", "Safeguards", {
    collapsed: true,
    childTypeHint: "safeguard",
  });
  n("sg-debrief", safeguards, "safeguard", "Team debrief after every major incident");
  n("sg-watch", safeguards, "safeguard", "Monitor exclusion patterns in incident data");
  const rights = n("rights", restrictive, "domain", "Human rights considerations", {
    collapsed: true,
    childTypeHint: "rights_consideration",
  });
  n("rt-heard", rights, "rights_consideration", "Jordan's right to be heard in planning");
  n("rt-education", rights, "rights_consideration", "Right to access learning alongside peers");

  // ---- 9. Data, fidelity & review ----------------------------------------
  const data = n("data", root, "domain", "Data, Fidelity & Review", {
    collapsed: true,
    templateId: "data",
    childTypeHint: "data_source",
    summary: "Make the plan testable.",
  });
  const behaviourData = n("behaviour-data", data, "domain", "Behaviour data", {
    collapsed: true,
    childTypeHint: "data_source",
  });
  n("bd-abc", behaviourData, "data_source", "ABC records focused on transition periods");
  n("bd-incident", behaviourData, "data_source", "Incident reports tagged by context");
  const qolData = n("qol-data", data, "domain", "Quality-of-life data", {
    collapsed: true,
    childTypeHint: "data_source",
  });
  n("qd-checkin", qolData, "data_source", "Weekly 5-minute check-in with Jordan");
  const healthData = n("health-data", data, "domain", "Health & sleep data", {
    collapsed: true,
    childTypeHint: "data_source",
  });
  n("hd-sleep", healthData, "data_source", "Two-week sleep diary kept with Mum");
  const openQs = n("open-qs", data, "domain", "Open questions", {
    collapsed: true,
    childTypeHint: "open_question",
  });
  n("oq-fidelity", openQs, "open_question", "Are transition warnings actually being given every time?");
  const review = n("review", data, "domain", "Next review priorities", {
    collapsed: true,
    childTypeHint: "open_question",
  });
  n("rv-4weeks", review, "open_question", "Review sleep diary and ABC data after 4 weeks");

  // ---- clinical cross-links ----------------------------------------------
  e("x-sleep-refusal", "se-sleep", "b-refusal", "increases_risk_of",
    "Refusals cluster on mornings after reported short sleep.");
  e("x-sleep-verbal", "se-sleep", "b-verbal", "increases_risk_of");
  e("x-writing-verbal", "a-writing", "b-property", "evokes",
    "Throwing materials almost always begins with an unsupported writing demand.");
  e("x-talkover-verbal", "a-talkover", "b-verbal", "evokes");
  e("x-abrupt-refusal", "a-abrupt", "b-refusal", "sets_the_occasion_for");
  e("x-verbal-removed", "b-verbal", "c-removed", "maintained_by",
    "Shouting reliably leads to the task being removed or shortened.");
  e("x-sentout-escape", "c-sentout", "f-escape", "contributes_to",
    "Being sent out functions as escape and may strengthen the pattern.");
  e("x-warning-escalation", "w-pacing", "e-seq", "indicates");
  e("x-breakcard-verbal", "cs-breakcard", "b-verbal", "reduces_risk_of");
  e("x-fcbreak-verbal", "fc-break", "b-verbal", "is_replacement_for",
    "Same escape function, safer form — honour every use while teaching.");
  e("x-timetable-refusal", "ps-timetable", "b-refusal", "reduces_risk_of");
  e("x-chunk-property", "dm-chunk", "b-property", "reduces_risk_of");
  e("x-sleepdiary-usleep", "hd-sleep", "u-sleep", "needs_data_about");
  e("x-abc-escape", "f-escape", "bd-abc", "is_measured_by",
    "ABC data is the main test of the escape hypothesis.");
  e("x-mentor-control", "pf-mentor", "g-control", "supports");

  return {
    title: "Sample: Jordan (Year 7)",
    participantLabel: "Jordan (pseudonym)",
    framework: "MEBS",
    version: "1.0",
    nodes,
    edges,
  };
}
