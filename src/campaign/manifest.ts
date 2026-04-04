/**
 * Campaign Manifest — parse and validate campaign YAML files
 *
 * A campaign manifest lists PRDs in order with labels, plus a config path.
 * Used by `shipwright campaign validate` and `shipwright campaign build`.
 */

import { parse as parseYaml } from "yaml";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";

export interface CampaignPhase {
  prd: string;
  label: string;
}

export interface CampaignManifest {
  config: string;
  phases: CampaignPhase[];
  /** Resolved absolute path of the manifest file */
  manifestPath: string;
  /** Directory containing the manifest (used to resolve relative paths) */
  baseDir: string;
}

interface RawManifest {
  config?: string;
  phases?: Array<{ prd?: string; label?: string }>;
}

export function loadManifest(manifestPath: string): CampaignManifest {
  const absPath = resolve(manifestPath);

  if (!existsSync(absPath)) {
    throw new Error(`Campaign manifest not found: ${absPath}`);
  }

  const raw = readFileSync(absPath, "utf-8");
  const parsed = parseYaml(raw) as RawManifest;

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid campaign manifest: could not parse YAML`);
  }

  const baseDir = dirname(absPath);

  // Validate config path
  const configRel = parsed.config;
  if (!configRel || typeof configRel !== "string") {
    throw new Error(`Campaign manifest missing required field: config`);
  }
  const configPath = resolve(baseDir, configRel);
  if (!existsSync(configPath)) {
    throw new Error(`Campaign config not found: ${configPath} (from manifest field "config: ${configRel}")`);
  }

  // Validate phases
  if (!Array.isArray(parsed.phases) || parsed.phases.length === 0) {
    throw new Error(`Campaign manifest must have at least one phase`);
  }

  const phases: CampaignPhase[] = [];
  for (let i = 0; i < parsed.phases.length; i++) {
    const phase = parsed.phases[i];
    if (!phase.prd || typeof phase.prd !== "string") {
      throw new Error(`Phase ${i + 1}: missing required field "prd"`);
    }
    if (!phase.label || typeof phase.label !== "string") {
      throw new Error(`Phase ${i + 1}: missing required field "label"`);
    }

    const prdPath = resolve(baseDir, phase.prd);
    if (!existsSync(prdPath)) {
      throw new Error(`Phase ${i + 1}: PRD not found: ${prdPath}`);
    }

    phases.push({
      prd: prdPath,
      label: phase.label,
    });
  }

  return {
    config: configPath,
    phases,
    manifestPath: absPath,
    baseDir,
  };
}
