/**
 * Markdown generation helpers for tracking files
 */

export function heading(level: number, text: string): string {
  return `${"#".repeat(level)} ${text}`;
}

export function timestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function statusEmoji(status: string): string {
  switch (status) {
    case "passed":
    case "completed":
    case "complete":
      return "✅";
    case "failed":
      return "❌";
    case "in_progress":
      return "🔄";
    case "pending":
      return "⏳";
    default:
      return "•";
  }
}

export function table(headers: string[], rows: string[][]): string {
  const headerLine = `| ${headers.join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;
  const bodyLines = rows.map((row) => `| ${row.join(" | ")} |`);
  return [headerLine, separator, ...bodyLines].join("\n");
}
