/**
 * Expertise Validator — validates expertise claims against the actual codebase
 */

import { existsSync } from "fs";
import { resolve } from "path";
import type { ExpertiseFile } from "./types.js";

export interface ValidationResult {
  domain: string;
  totalClaims: number;
  validClaims: number;
  staleFiles: string[];
  missingFiles: string[];
  issues: string[];
}

/**
 * Validate an expertise file's claims against the filesystem.
 * Checks that referenced files actually exist.
 */
export function validateExpertise(
  expertise: ExpertiseFile,
  baseDir: string
): ValidationResult {
  const result: ValidationResult = {
    domain: expertise.domain,
    totalClaims: 0,
    validClaims: 0,
    staleFiles: [],
    missingFiles: [],
    issues: [],
  };

  // Check key files
  const keyFiles = expertise.content.overview?.key_files ?? [];
  for (const file of keyFiles) {
    result.totalClaims++;
    const absPath = resolve(baseDir, file);
    if (existsSync(absPath)) {
      result.validClaims++;
    } else {
      result.missingFiles.push(file);
      result.issues.push(`Key file missing: ${file}`);
    }
  }

  // Check core implementation files
  for (const [section, data] of Object.entries(expertise.content.core_implementation ?? {})) {
    if (data && Array.isArray(data.files)) {
      for (const file of data.files) {
        result.totalClaims++;
        const absPath = resolve(baseDir, file);
        if (existsSync(absPath)) {
          result.validClaims++;
        } else {
          result.staleFiles.push(file);
          result.issues.push(`[${section}] File not found: ${file}`);
        }
      }
    }
  }

  // Check line count
  if (expertise.lineCount > 1000) {
    result.issues.push(`Expertise file exceeds 1000 lines (${expertise.lineCount} lines)`);
  }

  // Check metadata freshness
  if (expertise.content.metadata?.last_validated) {
    const lastValidated = new Date(expertise.content.metadata.last_validated);
    const daysSinceValidation = (Date.now() - lastValidated.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceValidation > 30) {
      result.issues.push(`Not validated in ${Math.floor(daysSinceValidation)} days`);
    }
  }

  return result;
}
