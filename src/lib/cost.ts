/**
 * Token/cost tracking per agent invocation
 */

// Subscription pricing — actual cost is $0. Token tracking for telemetry.
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-6": { input: 0, output: 0 },
  "claude-sonnet-4-6": { input: 0, output: 0 },
  "claude-haiku-4-5-20251001": { input: 0, output: 0 },
  "codex": { input: 0, output: 0 },
};

// API pricing per million tokens — what this WOULD cost at pay-per-token rates
const API_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-6": { input: 15.0, output: 75.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  "codex": { input: 2.5, output: 10.0 },
};

export interface CostEntry {
  agent: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: string;
  sprintId?: string;
}

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["claude-sonnet-4-6"];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 10000) / 10000;
}

/** Estimate what this would cost at API (pay-per-token) pricing */
export function estimateApiCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = API_PRICING[model] ?? API_PRICING["claude-sonnet-4-6"];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 10000) / 10000;
}

export class CostLedger {
  private entries: CostEntry[] = [];

  record(entry: CostEntry): void {
    this.entries.push(entry);
  }

  get totalCostUsd(): number {
    return this.entries.reduce((sum, e) => sum + e.costUsd, 0);
  }

  get totalTokens(): number {
    return this.entries.reduce((sum, e) => sum + e.inputTokens + e.outputTokens, 0);
  }

  get totalInputTokens(): number {
    return this.entries.reduce((sum, e) => sum + e.inputTokens, 0);
  }

  get totalOutputTokens(): number {
    return this.entries.reduce((sum, e) => sum + e.outputTokens, 0);
  }

  /** Total estimated API cost (what this would cost at pay-per-token rates) */
  get totalApiCostUsd(): number {
    return this.entries.reduce(
      (sum, e) => sum + estimateApiCost(e.model, e.inputTokens, e.outputTokens),
      0,
    );
  }

  tokensForSprint(sprintId: string): { input: number; output: number; total: number } {
    const filtered = this.entries.filter((e) => e.sprintId === sprintId);
    const input = filtered.reduce((sum, e) => sum + e.inputTokens, 0);
    const output = filtered.reduce((sum, e) => sum + e.outputTokens, 0);
    return { input, output, total: input + output };
  }

  apiCostForSprint(sprintId: string): number {
    return this.entries
      .filter((e) => e.sprintId === sprintId)
      .reduce((sum, e) => sum + estimateApiCost(e.model, e.inputTokens, e.outputTokens), 0);
  }

  tokensForAgent(agent: string): number {
    return this.entries
      .filter((e) => e.agent === agent)
      .reduce((sum, e) => sum + e.inputTokens + e.outputTokens, 0);
  }

  costForAgent(agent: string): number {
    return this.entries
      .filter((e) => e.agent === agent)
      .reduce((sum, e) => sum + e.costUsd, 0);
  }

  toJSON(): CostEntry[] {
    return [...this.entries];
  }
}
