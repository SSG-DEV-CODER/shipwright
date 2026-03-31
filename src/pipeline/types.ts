/**
 * Pipeline types — adversarial build pipeline state and results
 */

import type { SprintPlan, AcceptanceCriterion } from "../intake/types.js";

// --- Pipeline State ---

export type PipelinePhase =
  | "init"
  | "parsing"
  | "scouting"
  | "planning"
  | "negotiating"
  | "building"
  | "evaluating"
  | "improving"
  | "committing"
  | "complete"
  | "failed";

export interface PipelineState {
  prdPath: string;
  phase: PipelinePhase;
  currentSprintIndex: number;
  currentAttempt: number;
  sprints: SprintState[];
  startedAt: string;
  updatedAt: string;
  totalCostUsd: number;
}

export interface SprintState {
  plan: SprintPlan;
  status: "pending" | "in_progress" | "passed" | "failed";
  attempts: BuildAttempt[];
  contract?: SprintContract;
  expertiseUpdated: boolean;
  commitHash?: string;
  costUsd: number;
  durationMs: number;
}

// --- Contracts ---

export interface SprintContract {
  sprintId: string;
  title: string;

  // From PRD (immutable)
  acceptanceCriteria: AcceptanceCriterion[];

  // From Planner (proposed)
  implementation: {
    steps: ImplementationStep[];
    filesToCreate: string[];
    filesToModify: string[];
    validationCommands: string[];
  };

  // From Evaluator (requirements)
  evaluationCriteria: EvaluationCriterion[];

  // Negotiation history
  negotiationRounds: NegotiationRound[];
  signedAt?: string; // ISO timestamp — contract is locked once signed
}

export interface ImplementationStep {
  order: number;
  description: string;
  targetFiles: string[];
}

export interface EvaluationCriterion {
  id: string;
  criterion: string;
  weight: number; // 0-1, all weights must sum to 1
  specificChecks: string[];
}

export interface NegotiationRound {
  round: number;
  proposerRole: "planner" | "evaluator" | "negotiator";
  proposedChanges: string;
  outcome: "accepted" | "counter" | "rejected";
  reasoning: string;
}

// --- Evaluation ---

/**
 * Failure categories — determines who handles the fix:
 * - CODE: TypeScript errors, logic bugs, missing imports → Generator retries
 * - PLAN: Missing steps, wrong structure, incomplete scope → Planner amends plan
 * - INFRA: No database, missing env vars, deps not installed → Generator gets setup instructions
 */
export type FailureCategory = "code" | "plan" | "infra";

export interface BuildAttempt {
  attempt: number;
  startedAt: string;
  completedAt: string;
  filesChanged: string[];
  evalResult: EvalResult;
  costUsd: number;
  durationMs: number;
}

export interface EvalResult {
  passed: boolean;
  overallScore: number; // 0-10
  scores: EvalScore[];
  feedback: string; // detailed feedback for generator on failure
  failureReasons: string[]; // specific criteria that failed
  failureCategories?: CategorisedFailure[]; // categorised failures for smart routing
}

export interface EvalScore {
  criterionId: string;
  criterion: string;
  score: number; // 0-10
  reasoning: string;
  specificFailures: string[];
  failureCategory?: FailureCategory; // what type of failure this is
}

export interface CategorisedFailure {
  category: FailureCategory;
  description: string;
  criterionIds: string[]; // which criteria are affected
}

// --- Scout Reports ---

export interface ScoutReport {
  scoutId: string;
  targetDir: string;
  focus: string;
  findings: {
    relevantFiles: string[];
    patterns: string[];
    dependencies: string[];
    potentialIssues: string[];
  };
  durationMs: number;
}

// --- Final Results ---

export interface SprintResult {
  sprintId: string;
  status: "passed" | "failed";
  attempts: number;
  finalScore: number;
  commitHash?: string;
  costUsd: number;
  durationMs: number;
}

export interface PipelineResult {
  prdPath: string;
  status: "complete" | "failed";
  sprints: SprintResult[];
  totalCostUsd: number;
  totalDurationMs: number;
  expertiseFilesUpdated: string[];
}
