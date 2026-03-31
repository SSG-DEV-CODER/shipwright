/**
 * Sprint Planner — derives sprint plans from parsed PRDs
 *
 * Decomposes a PRD into sequential sprints based on:
 * 1. Explicit "Step N" or "Phase N" sections in the PRD
 * 2. Logical grouping of acceptance criteria
 * 3. Dependency ordering (scaffold before features)
 */

import type { PRD, PRDSection, AcceptanceCriterion, SprintPlan } from "./types.js";

export function deriveSprints(prd: PRD): SprintPlan[] {
  // Strategy 1: Look for explicit step/phase sections
  const explicitSprints = deriveFromExplicitSteps(prd);
  if (explicitSprints.length > 0) return explicitSprints;

  // Strategy 2: Look for "Detailed Steps" sections
  const detailedSprints = deriveFromDetailedSteps(prd);
  if (detailedSprints.length > 0) return detailedSprints;

  // Strategy 3: Group acceptance criteria into logical sprints
  return deriveFromCriteria(prd);
}

function deriveFromExplicitSteps(prd: PRD): SprintPlan[] {
  const sprints: SprintPlan[] = [];
  const stepPattern = /^step\s+(\d+)/i;
  const phasePattern = /^(?:sprint|phase)\s+(\d+)/i;

  for (const section of prd.sections) {
    const stepMatch = section.heading.match(stepPattern) || section.heading.match(phasePattern);
    if (stepMatch) {
      const sprintNum = parseInt(stepMatch[1], 10);
      const id = `sprint-${String(sprintNum).padStart(3, "0")}`;

      // Extract file targets from content
      const fileTargets = extractFileTargets(section.content);

      // Map acceptance criteria to this sprint
      const criteria = mapCriteriaToSprint(prd.acceptanceCriteria, section);

      sprints.push({
        id,
        title: section.heading.replace(/^step\s+\d+:\s*/i, "").replace(/^(?:sprint|phase)\s+\d+:\s*/i, "").trim() || section.heading,
        description: extractFirstParagraph(section.content),
        acceptanceCriteria: criteria,
        dependencies: sprintNum > 1 ? [`sprint-${String(sprintNum - 1).padStart(3, "0")}`] : [],
        estimatedComplexity: estimateComplexity(section.content, fileTargets.length),
        fileTargets,
      });
    }
  }

  return sprints;
}

function deriveFromDetailedSteps(prd: PRD): SprintPlan[] {
  const sprints: SprintPlan[] = [];
  const detailedSection = prd.sections.find(
    (s) => s.heading.toLowerCase().includes("detailed step")
  );
  if (!detailedSection) return [];

  // Parse numbered subsections within the detailed steps
  const lines = detailedSection.content.split("\n");
  let currentTitle = "";
  let currentContent: string[] = [];
  let sprintNum = 0;

  for (const line of lines) {
    const subheadingMatch = line.match(/^###\s+(?:Step\s+)?(\d+)[:.]\s*(.+)/i);
    if (subheadingMatch) {
      if (currentTitle && sprintNum > 0) {
        sprints.push(buildSprint(sprintNum, currentTitle, currentContent.join("\n"), prd));
      }
      sprintNum = parseInt(subheadingMatch[1], 10);
      currentTitle = subheadingMatch[2].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Push last sprint
  if (currentTitle && sprintNum > 0) {
    sprints.push(buildSprint(sprintNum, currentTitle, currentContent.join("\n"), prd));
  }

  return sprints;
}

function deriveFromCriteria(prd: PRD): SprintPlan[] {
  // If no explicit structure, create one sprint per ~5 acceptance criteria
  const sprints: SprintPlan[] = [];
  const chunkSize = 5;
  const criteria = prd.acceptanceCriteria;

  if (criteria.length === 0) {
    // Single sprint for the whole PRD
    return [{
      id: "sprint-001",
      title: prd.title,
      description: prd.summary,
      acceptanceCriteria: [],
      dependencies: [],
      estimatedComplexity: "medium",
      fileTargets: [],
    }];
  }

  for (let i = 0; i < criteria.length; i += chunkSize) {
    const chunk = criteria.slice(i, i + chunkSize);
    const sprintNum = Math.floor(i / chunkSize) + 1;
    sprints.push({
      id: `sprint-${String(sprintNum).padStart(3, "0")}`,
      title: `Sprint ${sprintNum}: ${chunk[0]?.text.slice(0, 50)}...`,
      description: chunk.map((c) => c.text).join("; "),
      acceptanceCriteria: chunk,
      dependencies: sprintNum > 1 ? [`sprint-${String(sprintNum - 1).padStart(3, "0")}`] : [],
      estimatedComplexity: chunk.length > 3 ? "large" : chunk.length > 1 ? "medium" : "small",
      fileTargets: [],
    });
  }

  return sprints;
}

// --- Helpers ---

function buildSprint(
  num: number,
  title: string,
  content: string,
  prd: PRD
): SprintPlan {
  const id = `sprint-${String(num).padStart(3, "0")}`;
  const fileTargets = extractFileTargets(content);
  const section: Partial<PRDSection> = { heading: title, content };
  const criteria = mapCriteriaToSprint(prd.acceptanceCriteria, section as PRDSection);

  return {
    id,
    title,
    description: extractFirstParagraph(content),
    acceptanceCriteria: criteria,
    dependencies: num > 1 ? [`sprint-${String(num - 1).padStart(3, "0")}`] : [],
    estimatedComplexity: estimateComplexity(content, fileTargets.length),
    fileTargets,
  };
}

function extractFileTargets(content: string): string[] {
  const files: string[] = [];
  // Match file paths in backticks or table cells
  const patterns = [
    /`([a-zA-Z0-9_/.-]+\.[a-zA-Z]+)`/g, // `path/to/file.ts`
    /│\s*`([^`]+\.[a-zA-Z]+)`/g, // table cell with file path
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const file = match[1];
      if (file.includes("/") || file.includes(".ts") || file.includes(".tsx") || file.includes(".yaml")) {
        files.push(file);
      }
    }
  }
  return [...new Set(files)];
}

function mapCriteriaToSprint(
  allCriteria: AcceptanceCriterion[],
  section: PRDSection
): AcceptanceCriterion[] {
  // Simple heuristic: criteria whose text overlaps with the sprint content
  const sectionWords = new Set(
    section.content.toLowerCase().split(/\W+/).filter((w) => w.length > 4)
  );

  return allCriteria.filter((c) => {
    const criterionWords = c.text.toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    const overlap = criterionWords.filter((w) => sectionWords.has(w));
    return overlap.length >= 2; // At least 2 significant word overlap
  });
}

function extractFirstParagraph(content: string): string {
  const lines = content.split("\n");
  const paragraphLines: string[] = [];
  for (const line of lines) {
    if (line.trim() === "" && paragraphLines.length > 0) break;
    if (line.trim() && !line.startsWith("#") && !line.startsWith("|") && !line.startsWith("```")) {
      paragraphLines.push(line.trim());
    }
  }
  return paragraphLines.join(" ").slice(0, 500);
}

function estimateComplexity(
  content: string,
  fileCount: number
): "small" | "medium" | "large" {
  if (fileCount > 10 || content.length > 3000) return "large";
  if (fileCount > 5 || content.length > 1500) return "medium";
  return "small";
}
