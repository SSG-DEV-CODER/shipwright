/**
 * Git helpers — atomic commits per sprint with shipwright: prefix
 */

import { execSync } from "child_process";

export function gitCommit(
  cwd: string,
  message: string,
  prefix: string = "shipwright:"
): string | null {
  try {
    // Stage all changes
    execSync("git add -A", { cwd, stdio: "pipe" });

    // Check if there are staged changes
    const status = execSync("git diff --cached --stat", { cwd, stdio: "pipe" }).toString().trim();
    if (!status) return null; // Nothing to commit

    // Commit
    const fullMessage = `${prefix} ${message}`;
    execSync(`git commit -m "${fullMessage.replace(/"/g, '\\"')}"`, {
      cwd,
      stdio: "pipe",
    });

    // Get commit hash
    const hash = execSync("git rev-parse --short HEAD", { cwd, stdio: "pipe" })
      .toString()
      .trim();

    return hash;
  } catch (err) {
    console.warn(`Git commit failed: ${err}`);
    return null;
  }
}

export function gitInit(cwd: string): boolean {
  try {
    execSync("git init", { cwd, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function isGitRepo(cwd: string): boolean {
  try {
    execSync("git rev-parse --git-dir", { cwd, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
