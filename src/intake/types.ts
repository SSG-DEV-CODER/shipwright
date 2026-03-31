/**
 * PRD intake types — parsed from markdown PRD files
 */

export interface PRD {
  title: string;
  status: string;
  owner: string;
  created: string;
  filePath: string;

  summary: string;
  motivation: string;

  sections: PRDSection[];
  acceptanceCriteria: AcceptanceCriterion[];
  deliverables: Deliverable[];
  openQuestions: string[];
}

export interface PRDSection {
  heading: string;
  level: number; // 1, 2, 3
  content: string;
  subsections: PRDSection[];
}

export interface AcceptanceCriterion {
  id: string; // ac-001, ac-002, ...
  text: string;
  source: string; // which PRD section it came from
  testable: boolean; // can be verified programmatically
  validationCommand?: string; // e.g., "pnpm typecheck"
}

export interface Deliverable {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
}

export interface SprintPlan {
  id: string; // sprint-001, sprint-002, ...
  title: string;
  description: string;
  acceptanceCriteria: AcceptanceCriterion[];
  dependencies: string[]; // sprint IDs this depends on
  estimatedComplexity: "small" | "medium" | "large";
  fileTargets: string[]; // expected files to create/modify
}
