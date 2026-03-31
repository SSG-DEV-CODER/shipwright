/**
 * PRD Parser — converts markdown PRD files into structured data
 *
 * Handles the CHOFF PRD format:
 * - YAML-like frontmatter (Status, Owner, Created)
 * - Markdown sections (## Summary, ## Motivation, ## Acceptance Criteria, etc.)
 * - Bulleted acceptance criteria (- [ ] criterion text)
 * - Numbered deliverables
 * - Detailed steps with source→destination mappings
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import type { PRD, PRDSection, AcceptanceCriterion, Deliverable } from "./types.js";

export function parsePRD(filePath: string): PRD {
  const absPath = resolve(filePath);
  const raw = readFileSync(absPath, "utf-8");
  const lines = raw.split("\n");

  const title = extractTitle(lines);
  const metadata = extractMetadata(lines);
  const sections = extractSections(lines);
  const acceptanceCriteria = extractAcceptanceCriteria(sections, raw);
  const deliverables = extractDeliverables(sections, raw);
  const openQuestions = extractOpenQuestions(sections);

  return {
    title,
    status: metadata.status ?? "Planning",
    owner: metadata.owner ?? "Unknown",
    created: metadata.created ?? new Date().toISOString().split("T")[0],
    filePath: absPath,
    summary: findSectionContent(sections, "summary") ?? "",
    motivation: findSectionContent(sections, "motivation") ?? "",
    sections,
    acceptanceCriteria,
    deliverables,
    openQuestions,
  };
}

function extractTitle(lines: string[]): string {
  for (const line of lines) {
    if (line.startsWith("# ")) {
      return line.slice(2).replace(/^PRD:\s*/i, "").trim();
    }
  }
  return "Untitled PRD";
}

function extractMetadata(lines: string[]): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const line of lines) {
    const match = line.match(/^\*\*(\w+):\*\*\s*(.+)/);
    if (match) {
      metadata[match[1].toLowerCase()] = match[2].trim();
    }
  }
  return metadata;
}

function extractSections(lines: string[]): PRDSection[] {
  const sections: PRDSection[] = [];
  let currentSection: PRDSection | null = null;
  let contentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.content = contentLines.join("\n").trim();
        sections.push(currentSection);
      }
      currentSection = {
        heading: headingMatch[2].trim(),
        level: headingMatch[1].length,
        content: "",
        subsections: [],
      };
      contentLines = [];
    } else if (currentSection) {
      contentLines.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.content = contentLines.join("\n").trim();
    sections.push(currentSection);
  }

  return sections;
}

function extractAcceptanceCriteria(
  sections: PRDSection[],
  raw: string
): AcceptanceCriterion[] {
  const criteria: AcceptanceCriterion[] = [];
  let counter = 1;

  // Strategy 1: Find "Acceptance Criteria" section
  const acSection = sections.find(
    (s) => s.heading.toLowerCase().includes("acceptance criteria")
  );
  if (acSection) {
    const items = extractChecklistItems(acSection.content);
    for (const item of items) {
      criteria.push({
        id: `ac-${String(counter++).padStart(3, "0")}`,
        text: item,
        source: acSection.heading,
        testable: isTestable(item),
        validationCommand: inferValidationCommand(item),
      });
    }
  }

  // Strategy 2: Find checklist items (- [ ]) anywhere in the doc
  if (criteria.length === 0) {
    const checklistPattern = /^[-*]\s*\[[ x]\]\s*(.+)$/gm;
    let match: RegExpExecArray | null;
    while ((match = checklistPattern.exec(raw)) !== null) {
      criteria.push({
        id: `ac-${String(counter++).padStart(3, "0")}`,
        text: match[1].trim(),
        source: "document",
        testable: isTestable(match[1]),
        validationCommand: inferValidationCommand(match[1]),
      });
    }
  }

  // Strategy 3: Look for "Success Criteria" or "Deliverables" sections
  if (criteria.length === 0) {
    for (const section of sections) {
      if (
        section.heading.toLowerCase().includes("success") ||
        section.heading.toLowerCase().includes("deliverable")
      ) {
        const items = extractBulletItems(section.content);
        for (const item of items) {
          criteria.push({
            id: `ac-${String(counter++).padStart(3, "0")}`,
            text: item,
            source: section.heading,
            testable: isTestable(item),
            validationCommand: inferValidationCommand(item),
          });
        }
      }
    }
  }

  return criteria;
}

function extractDeliverables(
  sections: PRDSection[],
  raw: string
): Deliverable[] {
  const deliverables: Deliverable[] = [];
  let counter = 1;

  const delSection = sections.find(
    (s) => s.heading.toLowerCase().includes("deliverable")
  );
  if (delSection) {
    const items = extractTableRows(delSection.content);
    if (items.length > 0) {
      for (const item of items) {
        deliverables.push({
          id: `del-${String(counter++).padStart(3, "0")}`,
          description: item,
          status: "pending",
        });
      }
    } else {
      // Fallback to bullet items
      const bullets = extractBulletItems(delSection.content);
      for (const item of bullets) {
        deliverables.push({
          id: `del-${String(counter++).padStart(3, "0")}`,
          description: item,
          status: "pending",
        });
      }
    }
  }

  return deliverables;
}

function extractOpenQuestions(sections: PRDSection[]): string[] {
  const qSection = sections.find(
    (s) =>
      s.heading.toLowerCase().includes("open question") ||
      s.heading.toLowerCase().includes("question")
  );
  if (qSection) {
    // Match both bullet items and numbered items
    const items = [
      ...extractBulletItems(qSection.content),
      ...extractNumberedItems(qSection.content),
    ];
    return items.filter((q) => q.includes("?") || q.length > 10);
  }
  return [];
}

// --- Helpers ---

function extractChecklistItems(content: string): string[] {
  const items: string[] = [];
  const pattern = /^[-*]\s*\[[ x]\]\s*(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    items.push(match[1].trim());
  }
  return items;
}

function extractBulletItems(content: string): string[] {
  const items: string[] = [];
  const pattern = /^[-*]\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const text = match[1].trim();
    if (text.length > 5) {
      items.push(text);
    }
  }
  return items;
}

function extractNumberedItems(content: string): string[] {
  const items: string[] = [];
  const pattern = /^\d+\.\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    const text = match[1].trim();
    if (text.length > 5) {
      items.push(text);
    }
  }
  return items;
}

function extractTableRows(content: string): string[] {
  const items: string[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    if (line.startsWith("|") && !line.includes("---")) {
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      // Skip header row (usually has # or short labels)
      if (cells.length >= 2 && cells[1].length > 10) {
        items.push(cells[1]);
      }
    }
  }
  return items;
}

function findSectionContent(sections: PRDSection[], keyword: string): string | undefined {
  const section = sections.find(
    (s) => s.heading.toLowerCase().includes(keyword)
  );
  return section?.content;
}

function isTestable(text: string): boolean {
  const testableKeywords = [
    "compiles",
    "passes",
    "responds",
    "returns",
    "loads",
    "succeeds",
    "clean",
    "zero errors",
    "no imports",
    "creates",
    "starts",
    "serves",
    "works",
    "validates",
    "parses",
  ];
  const lower = text.toLowerCase();
  return testableKeywords.some((kw) => lower.includes(kw));
}

function inferValidationCommand(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("typecheck") || lower.includes("typescript") || lower.includes("compiles"))
    return "bunx tsc --noEmit";
  if (lower.includes("test") && lower.includes("pass")) return "bun test";
  if (lower.includes("lint")) return "bunx eslint .";
  if (lower.includes("build") && lower.includes("succeed")) return "bun run build";
  return undefined;
}
