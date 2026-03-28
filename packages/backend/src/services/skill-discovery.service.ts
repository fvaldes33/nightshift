import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiscoveredCommand {
  /** Display name (e.g. "commit") */
  name: string;
  /** Short description */
  description: string;
  /** Where it came from */
  source: "builtin" | "project" | "global";
}

// ---------------------------------------------------------------------------
// Built-in commands (always available, match Claude Code defaults)
// ---------------------------------------------------------------------------

const BUILTIN_COMMANDS: DiscoveredCommand[] = [
  { name: "commit", description: "Create a git commit", source: "builtin" },
  { name: "review-pr", description: "Review a pull request", source: "builtin" },
  { name: "simplify", description: "Review code for quality", source: "builtin" },
];

// ---------------------------------------------------------------------------
// YAML frontmatter parser (lightweight — avoids adding a dep)
// ---------------------------------------------------------------------------

function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match?.[1]) return {};

  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    result[key] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Command discovery: .claude/commands/*.md
// ---------------------------------------------------------------------------

function discoverCommands(dir: string, source: "project" | "global"): DiscoveredCommand[] {
  if (!existsSync(dir)) return [];

  const results: DiscoveredCommand[] = [];
  try {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".md")) continue;
      const name = file.replace(/\.md$/, "");
      const filePath = join(dir, file);
      try {
        const content = readFileSync(filePath, "utf-8");
        // First non-empty line (after frontmatter) is the description, or use frontmatter
        const fm = parseFrontmatter(content);
        const description =
          fm.description ||
          content
            .replace(/^---[\s\S]*?---\s*/, "")
            .split("\n")
            .map((l) => l.trim())
            .find((l) => l.length > 0 && !l.startsWith("#")) ||
          name;
        results.push({ name, description, source });
      } catch {
        results.push({ name, description: name, source });
      }
    }
  } catch {
    // Directory not readable
  }
  return results;
}

// ---------------------------------------------------------------------------
// Skill discovery: .claude/skills/**/SKILL.md
// ---------------------------------------------------------------------------

function discoverSkills(dir: string, source: "project" | "global"): DiscoveredCommand[] {
  if (!existsSync(dir)) return [];

  const results: DiscoveredCommand[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const entryPath = resolve(dir, entry);
      try {
        const stat = statSync(entryPath);
        if (!stat.isDirectory()) continue;
      } catch {
        continue;
      }

      const skillFile = join(entryPath, "SKILL.md");
      if (!existsSync(skillFile)) continue;

      try {
        const content = readFileSync(skillFile, "utf-8");
        const fm = parseFrontmatter(content);

        // Skip skills explicitly marked as not user-invocable
        if (fm["user-invocable"] === "false") continue;

        const name = fm.name || entry;
        const description = fm.description || name;
        results.push({ name, description, source });
      } catch {
        // Can't read skill file — skip
      }
    }
  } catch {
    // Directory not readable
  }
  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Discover all available slash commands for a session.
 * Merges built-in commands, project-level commands/skills, and global commands/skills.
 * Project-level items override global items with the same name.
 */
export function discoverSessionCommands(projectCwd: string | null): DiscoveredCommand[] {
  const home = homedir();

  // Global sources
  const globalCommands = discoverCommands(join(home, ".claude", "commands"), "global");
  const globalSkills = discoverSkills(join(home, ".claude", "skills"), "global");

  // Project sources
  const projectCommands = projectCwd
    ? discoverCommands(join(projectCwd, ".claude", "commands"), "project")
    : [];
  const projectSkills = projectCwd
    ? discoverSkills(join(projectCwd, ".claude", "skills"), "project")
    : [];

  // Merge: project overrides global, both override builtins
  const byName = new Map<string, DiscoveredCommand>();

  for (const cmd of BUILTIN_COMMANDS) byName.set(cmd.name, cmd);
  for (const cmd of globalCommands) byName.set(cmd.name, cmd);
  for (const cmd of globalSkills) byName.set(cmd.name, cmd);
  for (const cmd of projectCommands) byName.set(cmd.name, cmd);
  for (const cmd of projectSkills) byName.set(cmd.name, cmd);

  return Array.from(byName.values());
}
