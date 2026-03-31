/**
 * Token/cost tracking per agent invocation
 */

// Pricing per million tokens (as of 2025-05)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-20250514": { input: 15.0, output: 75.0 },
  "claude-sonnet-4-20250514": { input: 3.0, output: 15.0 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  // Codex uses subscription pricing — track tokens but cost is flat rate
  "codex": { input: 0, output: 0 },
};

export interface CostEntry {
  agent: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: string;
}

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING["claude-sonnet-4-20250514"];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 10000) / 10000; // 4 decimal places
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

  costForAgent(agent: string): number {
    return this.entries
      .filter((e) => e.agent === agent)
      .reduce((sum, e) => sum + e.costUsd, 0);
  }

  toJSON(): CostEntry[] {
    return [...this.entries];
  }
}
