// The classification rules. Pure functions (no git, no file system) so every rule is unit-tested.
// Rules run in a fixed order and the first match wins; if none matches the result is "undecided"
// and the caller must pass a type. Nothing here guesses.
import { matchesAny } from "./glob.mjs";
import { ownersOf } from "./ownership.mjs";

/**
 * @typedef {{ status: string, path: string }} ChangedFile
 * @typedef {{
 *   teamLabels: string[],
 *   types: Record<string, { commitTypes: string[] }>,
 *   commitPrefixToType: Record<string, string>,
 *   docsPaths: string[],
 *   choreRules: { commitType: string, paths: string[] }[],
 *   testPaths: string[],
 *   codePaths: string[],
 * }} WorkflowConfig
 */

/**
 * Reads a Conventional-Commit prefix from a title or commit subject. A leading "[label] " is ignored.
 * @param {string | null | undefined} text
 * @returns {{ prefix: string, scope: string | null } | null}
 */
export function parsePrefix(text) {
  if (!text) return null;
  const m = /^(?:\[[^\]]+\]\s*)?([a-z]+)(?:\(([^)]*)\))?!?:\s/.exec(text.trim());
  return m ? { prefix: m[1], scope: m[2] ?? null } : null;
}

/**
 * Splits a branch name into its team label and the rest, e.g. "team-2/14-login" -> "team-2".
 * @param {string | null | undefined} branch
 * @param {string[]} teamLabels
 */
export function branchLabel(branch, teamLabels) {
  const first = (branch ?? "").split("/")[0];
  return teamLabels.includes(first) ? first : null;
}

/**
 * The branch a pull request from `branch` must target (see "Branches" in CLAUDE.md).
 * @param {string | null | undefined} branch
 * @param {string[]} teamLabels
 */
export function baseFor(branch, teamLabels) {
  if (!branch) return null;
  if (branch === "main") return "prod";
  const feature = /^feature\/(team-[1-4])$/.exec(branch);
  if (feature) return "main";
  const label = branchLabel(branch, teamLabels);
  if (!label) return null;
  return /^team-[1-4]$/.test(label) ? `feature/${label}` : "main";
}

/**
 * @param {{
 *   files: ChangedFile[],
 *   config: WorkflowConfig,
 *   ownership: { path: string, owner: string }[],
 *   kind: "issue" | "pr" | "commit",
 *   hint?: string | null,
 *   branch?: string | null,
 *   type?: string | null,
 *   label?: string | null,
 * }} input
 */
export function classifyChange(input) {
  const { files, config, ownership, kind, hint = null, branch = null } = input;
  const paths = files.map((f) => f.path);
  const warnings = [];

  /** @type {{ type: string, commitType: string | null, rule: string } | null} */
  let decision = null;

  const isDocs = (p) => matchesAny(p, config.docsPaths);
  const isTest = (p) => matchesAny(p, config.testPaths);
  const chorePaths = config.choreRules.flatMap((r) => r.paths);
  const isChore = (p) => matchesAny(p, chorePaths);
  const isCode = (p) => matchesAny(p, config.codePaths);

  // 1. Explicit type, a Conventional-Commit prefix in the title, or a release PR from main.
  const prefix = parsePrefix(hint);
  if (input.type) {
    decision = {
      type: input.type,
      commitType: config.types[input.type]?.commitTypes[0] ?? null,
      rule: "explicit-type",
    };
  } else if (prefix && config.commitPrefixToType[prefix.prefix]) {
    decision = {
      type: config.commitPrefixToType[prefix.prefix],
      commitType: prefix.prefix,
      rule: "commit-prefix",
    };
  } else if (kind === "pr" && branch === "main") {
    decision = { type: "release", commitType: null, rule: "release-branch" };
  }

  // 2-6. Rules over the changed files.
  if (!decision && paths.length === 0) {
    return undecided(
      ["feature", "bug", "docs", "chore", "refactor"],
      "No changed files and no title prefix to go on.",
    );
  }
  if (!decision) {
    const nonDocs = paths.filter((p) => !isDocs(p));
    if (nonDocs.length === 0) {
      decision = { type: "docs", commitType: "docs", rule: "docs-only" };
    } else if (nonDocs.every((p) => isTest(p) || isChore(p))) {
      let commitType = "chore";
      if (nonDocs.every(isTest)) commitType = "test";
      else {
        for (const rule of config.choreRules) {
          if (rule.commitType !== "chore" && nonDocs.every((p) => matchesAny(p, rule.paths)))
            commitType = rule.commitType;
        }
      }
      decision = { type: "chore", commitType, rule: commitType === "test" ? "tests-only" : "tooling-only" };
    } else if (files.some((f) => f.status === "A" && isCode(f.path) && !isTest(f.path) && !isChore(f.path))) {
      decision = { type: "feature", commitType: "feat", rule: "new-code" };
    }
  }
  if (!decision) {
    return undecided(
      ["feature", "bug", "refactor"],
      "The changed files do not decide between feature, bug and refactor.",
    );
  }

  // Label: explicit, then the branch prefix, then the single owner of the changed files.
  const owners = ownersOf(paths, ownership);
  let label = input.label ?? null;
  let labelSource = label ? "explicit" : null;
  if (!label) {
    const fromBranch = branchLabel(branch, config.teamLabels);
    if (fromBranch) {
      label = fromBranch;
      labelSource = "branch";
    } else if (owners.length === 1) {
      label = owners[0];
      labelSource = "files";
    }
  }
  const errors = [];
  if (!label && owners.length > 1) {
    errors.push(
      `The changed files belong to several owners (${owners.join(", ")}). Split the change, or pass --label.`,
    );
  }
  if (!label && owners.length === 0 && kind !== "commit") {
    errors.push(
      "No team label could be derived (no owned files, branch does not start with a team label). Pass --label.",
    );
  }
  if (label && labelSource !== "files") {
    const others = owners.filter((o) => o !== label);
    if (others.length > 0)
      warnings.push(
        `Changes files owned by ${others.join(", ")}; the issue must explain why (see CLAUDE.md).`,
      );
  }

  return {
    ok: errors.length === 0,
    undecided: false,
    type: decision.type,
    commitType: decision.commitType,
    rule: decision.rule,
    label,
    labelSource,
    scope: label,
    base: kind === "pr" ? baseFor(branch, config.teamLabels) : null,
    owners,
    warnings,
    errors,
  };
}

/** @param {string[]} candidates @param {string} reason */
function undecided(candidates, reason) {
  return {
    ok: false,
    undecided: true,
    candidates,
    errors: [`${reason} Pass --type <${candidates.join("|")}>.`],
    warnings: [],
  };
}
