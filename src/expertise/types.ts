/**
 * Expertise types — persistent YAML knowledge files
 */

export interface ExpertiseFile {
  domain: string; // e.g., "nextjs-payload", "supabase-postgres"
  filePath: string;
  lineCount: number;
  lastUpdated: string;
  content: ExpertiseContent;
}

export interface ExpertiseContent {
  overview: {
    description: string;
    scope: string[];
    key_files: string[];
  };

  core_implementation: Record<string, ExpertiseSection>;

  patterns: ExpertisePattern[];
  gotchas: ExpertiseGotcha[];
  decisions: ExpertiseDecision[];
  anti_patterns: string[];

  metadata: {
    created: string;
    last_validated: string;
    source_sprints: string[];
    stability: "evolving" | "stable"; // stable = no changes for 3+ sprints
    consecutive_no_change: number;
  };
}

export interface ExpertiseSection {
  description: string;
  files: string[];
  key_functions?: string[];
  notes?: string[];
}

export interface ExpertisePattern {
  name: string;
  description: string;
  example?: string;
  added_date: string;
  source_sprint?: string;
}

export interface ExpertiseGotcha {
  description: string;
  impact: "high" | "medium" | "low";
  mitigation: string;
  added_date: string;
  source_sprint?: string;
}

export interface ExpertiseDecision {
  decision: string;
  reasoning: string;
  alternatives_considered: string[];
  added_date: string;
  source_sprint?: string;
}

export interface ExpertiseContext {
  files: ExpertiseFile[];
  totalLines: number;
}

export interface ExpertiseUpdate {
  domain: string;
  newPatterns: Omit<ExpertisePattern, "added_date">[];
  newGotchas: Omit<ExpertiseGotcha, "added_date">[];
  newDecisions: Omit<ExpertiseDecision, "added_date">[];
  corrections: { path: string; oldValue: string; newValue: string }[];
  removals: string[];
}
