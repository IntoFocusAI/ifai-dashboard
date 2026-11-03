/** Row shapes for the `public.canvas_ai_*` views in docs/ai-search-truth-contract.md. */

export type AiRunState = "completed" | "partial" | "running" | "failed" | "historical";

export type AiCurrentRun = {
  audit_run_id: string;
  run_state: AiRunState | string;
  collector_version: string | null;
  prompt_set_hash: string | null;
  expected_calls: number | null;
  attempted_calls: number | null;
  answered_calls: number | null;
  error_calls: number | null;
  started_at: string | null;
  completed_at: string | null;
  published_at: string | null;
  missing_calls: number | null;
  /** Present on history rows. The current-run view omits it. */
  is_published?: boolean | null;
  run_kind?: string | null;
};

export type AiOutcome = "fender_win" | "competitor_win" | "unresolved" | "error" | "not_scored";

export type AiMaterialHallucination =
  | "none"
  | "confirmed"
  | "suspected"
  | "historical_unverified"
  | "not_evaluated";

export type AiPromptKind = "commercial" | "probe";

export type AiCallRow = {
  id: string;
  audit_run_id: string;
  sim_id: number;
  engine: string | null;
  model: string | null;
  category: string | null;
  prompt: string | null;
  prompt_key: string | null;
  prompt_kind: AiPromptKind | string | null;
  call_status: "answered" | "error" | string | null;
  outcome: AiOutcome | string | null;
  primary_brand: string | null;
  material_hallucination: AiMaterialHallucination | string | null;
  hallucination_evidence: string | null;
  root_cause: string | null;
  remediation_patch: string | null;
  error_message: string | null;
  attempt_no: number | null;
  repeat_no: number | null;
  created_at: string | null;
  /** Set when a history read already returned the stored answer. */
  answer_text?: string | null;
};

export type AiProbeRow = {
  audit_run_id: string;
  sim_id: number;
  prompt_key: string | null;
  prompt: string | null;
  engine: string | null;
  model: string | null;
  call_status: string | null;
  material_hallucination: AiMaterialHallucination | string | null;
  hallucination_evidence: string | null;
  verified_claim: string | null;
  verified_source_url: string | null;
  verified_at: string | null;
  created_at: string | null;
} & Partial<ProbeCatalogFields>;

/**
 * Collector v15's catalog rotation columns on canvas_ai_probes and canvas_ai_history_probes.
 * All NULL until the rotation is switched on.
 */
export type ProbeCatalogFields = {
  probe_asin: string | null;
  probe_asins: string[] | string | null;
  probe_fender_sku: string | null;
  probe_category: string | null;
  probe_series: string | null;
  probe_spec_field: string | null;
  probe_expected_value: string | null;
  probe_source_url: string | null;
  probe_amazon_value: string | null;
  probe_is_anchor: boolean | null;
};

/** One row of canvas_ai_probe_coverage: catalog products checked, per run, category, and engine. */
export type AiProbeCoverageRow = {
  audit_run_id: string;
  cycle_no: number | null;
  category: string | null;
  engine: string | null;
  models_in_scope: number | null;
  models_checked: number | null;
  asins_covered: number | null;
  wrong_answers: number | null;
};

export type AiCitationRow = {
  audit_run_id: string;
  sim_id: number;
  simulation_id: string;
  prompt_key: string | null;
  prompt_kind: string | null;
  category: string | null;
  engine: string | null;
  position: number | null;
  url: string | null;
  domain: string | null;
  title: string | null;
};

export type AiSearchSnapshot = {
  run: AiCurrentRun;
  calls: AiCallRow[];
  probes: AiProbeRow[];
  citations: AiCitationRow[];
  /**
   * Citation rows stored with the run. The copy may list fewer URLs than this
   * count. When it does, the citation panel says the rows were stored and does
   * not treat the shorter list as a change in the citation ecosystem.
   */
  storedCitationCount?: number;
  /**
   * canvas_ai_probe_coverage rows, read only when a fact check names a catalog product.
   * Null when that read failed.
   */
  probeCoverage?: AiProbeCoverageRow[] | null;
};

/** Every surface renders one of these. A failed or missing read is never shown as zero. */
export type AiSearchRead =
  | { phase: "loading" }
  | {
      phase: "error";
      message: string;
      /**
       * Set when the panels' history selection failed or holds no stored calls, not the
       * published run. The map's published read never carries it.
       */
      selection?: "failed" | "empty";
    }
  | { phase: "no-run" }
  | { phase: "ready"; snapshot: AiSearchSnapshot; stale?: boolean };
