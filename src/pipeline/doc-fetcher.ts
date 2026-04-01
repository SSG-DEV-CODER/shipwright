/**
 * Vendor Documentation Fetcher — downloads vendor docs via MCP at build start.
 *
 * Uses Context7 + agent-browser MCP servers to fetch official documentation
 * for all technologies referenced in the PRD. Docs are saved locally to
 * .shipwright/vendor-docs/<tech-slug>/ and indexed in INDEX.md.
 *
 * This is the ONLY module that uses MCP. No agent has live MCP access.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { resolve, join } from "path";
import { ensureDir, writeText, readText } from "../lib/fs.js";
import type { ShipwrightConfig, McpServerConfig } from "../config.js";

export interface DocFetchResult {
  technologies: string[];
  docsDir: string;
  indexPath: string;
  fetched: string[];
  cached: string[];
  failed: string[];
  durationMs: number;
}

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function techSlug(technology: string): string {
  return technology
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/-+/g, "-");
}

function isCacheValid(docsDir: string, technology: string): boolean {
  const techDir = resolve(docsDir, techSlug(technology));
  if (!existsSync(techDir)) return false;

  try {
    const stat = statSync(techDir);
    if (Date.now() - stat.mtimeMs > CACHE_MAX_AGE_MS) return false;

    // Check there's at least one .md file
    const files = readdirSync(techDir).filter((f) => f.endsWith(".md"));
    return files.length > 0;
  } catch {
    return false;
  }
}

/** Check if a tech was already attempted but yielded no docs (known failure — don't retry within cache window) */
function isPreviouslyFailed(docsDir: string, technology: string): boolean {
  const techDir = resolve(docsDir, techSlug(technology));
  if (!existsSync(techDir)) return false;

  try {
    const stat = statSync(techDir);
    if (Date.now() - stat.mtimeMs > CACHE_MAX_AGE_MS) return false;

    // Dir exists within cache window but has no .md files — was attempted, found nothing
    const files = readdirSync(techDir).filter((f) => f.endsWith(".md"));
    return files.length === 0;
  } catch {
    return false;
  }
}

export async function fetchVendorDocs(
  config: ShipwrightConfig,
  technologies: string[],
  _targetDir: string,
): Promise<DocFetchResult> {
  const start = Date.now();
  const docsDir = resolve(config.vendorDocsDir);
  ensureDir(docsDir);

  const cached: string[] = [];
  const toFetch: string[] = [];

  for (const tech of technologies) {
    if (isCacheValid(docsDir, tech)) {
      cached.push(tech);
    } else if (isPreviouslyFailed(docsDir, tech)) {
      // Already tried, no docs found — don't waste time re-fetching
      cached.push(tech);
    } else {
      toFetch.push(tech);
    }
  }

  const fetched: string[] = [];
  const failed: string[] = [];

  if (toFetch.length > 0 && Object.keys(config.mcpServers).length > 0) {
    // Create directories for each technology
    for (const tech of toFetch) {
      ensureDir(resolve(docsDir, techSlug(tech)));
    }

    try {
      await runDocFetcherAgent(
        config.mcpServers,
        toFetch,
        docsDir,
        config.models.validator, // Use validator model (sonnet — cheap, fast)
      );

      // Verify which technologies got docs
      for (const tech of toFetch) {
        const techDir = resolve(docsDir, techSlug(tech));
        const files = existsSync(techDir)
          ? readdirSync(techDir).filter((f) => f.endsWith(".md"))
          : [];
        if (files.length > 0) {
          fetched.push(tech);
        } else {
          failed.push(tech);
        }
      }
    } catch (err) {
      console.warn(`[doc-fetcher] Agent failed: ${err}`);
      failed.push(...toFetch);
    }
  } else if (toFetch.length > 0) {
    failed.push(...toFetch);
  }

  // Build INDEX.md
  const indexContent = buildIndex(docsDir, technologies);
  const indexPath = resolve(docsDir, "INDEX.md");
  writeText(indexPath, indexContent);

  return {
    technologies,
    docsDir,
    indexPath,
    fetched,
    cached,
    failed,
    durationMs: Date.now() - start,
  };
}

async function runDocFetcherAgent(
  mcpServers: Record<string, McpServerConfig>,
  technologies: string[],
  docsDir: string,
  model: string,
): Promise<void> {
  let query: any;
  try {
    const sdk = await import("@anthropic-ai/claude-code");
    query = sdk.query;
  } catch {
    console.warn("[doc-fetcher] Claude Code SDK not available. Cannot fetch docs.");
    return;
  }

  const systemPrompt = readFileSync(
    resolve(import.meta.dir, "../prompts/doc-fetcher.md"),
    "utf-8",
  );

  const techInstructions = technologies.map((tech) => {
    const slug = techSlug(tech);
    const dir = resolve(docsDir, slug);
    return `- **${tech}** → save docs to: ${dir}/`;
  });

  const userPrompt = [
    `## Technologies to Fetch Documentation For`,
    ``,
    ...techInstructions,
    ``,
    `## Instructions`,
    ``,
    `For each technology above:`,
    `1. Use Context7 MCP to resolve the library and fetch documentation`,
    `2. Save setup, configuration, and API reference as separate .md files`,
    `3. If Context7 doesn't have it, use agent-browser to find official docs`,
    `4. Skip any technology you cannot find docs for`,
    ``,
    `Use the Write tool to save files to the exact paths listed above.`,
  ].join("\n");

  const timestamp = () => new Date().toISOString().split("T")[1].replace("Z", "");

  const heartbeat = setInterval(() => {
    console.log(`[${timestamp()}] [DOC_FETCH] fetcher working...`);
  }, 60_000);

  try {
    const stream = query({
      prompt: userPrompt,
      options: {
        model,
        customSystemPrompt: systemPrompt,
        allowedTools: ["Read", "Write", "Glob", "Grep"],
        maxTurns: technologies.length * 10,
        cwd: docsDir,
        permissionMode: "bypassPermissions" as const,
        mcpServers: mcpServers as Record<string, any>,
      },
    });

    for await (const event of stream) {
      // Just consume the stream — docs are written to disk by the agent
      if (event.type === "result") break;
    }
  } finally {
    clearInterval(heartbeat);
  }
}

function buildIndex(docsDir: string, technologies: string[]): string {
  const lines: string[] = [
    `# Vendor Documentation Index`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `## Available Documentation`,
    ``,
  ];

  for (const tech of technologies) {
    const slug = techSlug(tech);
    const techDir = resolve(docsDir, slug);

    if (!existsSync(techDir)) {
      lines.push(`### ${tech}`);
      lines.push(`- Status: NOT AVAILABLE`);
      lines.push(``);
      continue;
    }

    const files = readdirSync(techDir).filter((f) => f.endsWith(".md"));
    if (files.length === 0) {
      lines.push(`### ${tech}`);
      lines.push(`- Status: NOT AVAILABLE`);
      lines.push(``);
      continue;
    }

    lines.push(`### ${tech}`);
    lines.push(`- Path: ${techDir}/`);
    lines.push(`- Files:`);

    for (const file of files.sort()) {
      const filePath = join(techDir, file);
      try {
        const content = readText(filePath);
        const firstLine = content.split("\n").find((l) => l.startsWith("# "));
        const title = firstLine ? firstLine.replace(/^#\s*/, "") : file;
        lines.push(`  - [${file}](${filePath}) — ${title}`);
      } catch {
        lines.push(`  - [${file}](${filePath})`);
      }
    }
    lines.push(``);
  }

  return lines.join("\n");
}
