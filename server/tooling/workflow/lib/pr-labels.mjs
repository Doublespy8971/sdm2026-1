// Which status, type and size labels a pull request should carry. Pure: the caller passes the PR's
// data from GitHub, so every rule is unit-tested. See "Labels" in CLAUDE.md.
import { detectPrType } from "./check-pr.mjs";
import { matchesAny } from "./glob.mjs";
import { kindOfMainPr, parsePrefix } from "./rules.mjs";
import { headingsOf, sectionsOf } from "./template.mjs";

/** Bases that are not another PR: a PR into anything else is stacked on that PR. */
const LONG_LIVED = /^(main|prod|feature\/team-[1-4])$/;

/** Changes that make a PR large however few lines they touch (#52). */
const LARGE_PATHS = [
  "server/core/src/shared/**",
  "**/package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  ".github/**",
];
const TEST_FILE = /\.test\.[tj]s$/;

export const SIZE_LIMITS = { tiny: { lines: 20, files: 2 }, small: { lines: 150 }, medium: { lines: 400 } };

/**
 * @typedef {{ author: string | null, state: string }} Review
 * @typedef {{
 *   number: number,
 *   state: "OPEN" | "CLOSED" | "MERGED",
 *   isDraft: boolean,
 *   title: string,
 *   body: string,
 *   author: string | null,
 *   base: string,
 *   head: string,
 *   labels: string[],
 *   reviews: Review[],
 *   unresolvedThreads: number,
 *   additions: number,
 *   deletions: number,
 *   files: string[],
 * }} PullRequest
 */

/** @param {string} base */
export const isStacked = (base) => !LONG_LIVED.test(base);

/**
 * What the PR is waiting on: "author", "review" or "merge", in that order of precedence.
 * - author: a draft, changes requested by a reviewer, or an unresolved review thread
 * - review: no approval from someone other than the author
 * - merge: approved, with nothing open
 * Only each reviewer's latest decisive review counts (approved, changes requested or dismissed),
 * the way GitHub counts them; plain comments don't change a decision.
 * @param {Pick<PullRequest, "isDraft" | "author" | "reviews" | "unresolvedThreads">} pr
 */
export function waitingOn(pr) {
  /** @type {Map<string, string>} */
  const latest = new Map();
  for (const r of pr.reviews) {
    if (!r.author || r.author === pr.author) continue;
    if (["APPROVED", "CHANGES_REQUESTED", "DISMISSED"].includes(r.state)) latest.set(r.author, r.state);
  }
  const states = [...latest.values()];
  if (pr.isDraft || states.includes("CHANGES_REQUESTED") || pr.unresolvedThreads > 0) return "author";
  if (!states.includes("APPROVED")) return "review";
  return "merge";
}

/**
 * Size from the diff (labels.json "size" group).
 * @param {Pick<PullRequest, "additions" | "deletions" | "files">} pr
 * @returns {"tiny" | "small" | "medium" | "large"}
 */
export function sizeOf(pr) {
  const lines = pr.additions + pr.deletions;
  const large = pr.files.some((f) => matchesAny(f, LARGE_PATHS) && !TEST_FILE.test(f));
  if (large || lines > SIZE_LIMITS.medium.lines) return "large";
  if (lines <= SIZE_LIMITS.tiny.lines && pr.files.length <= SIZE_LIMITS.tiny.files) return "tiny";
  if (lines <= SIZE_LIMITS.small.lines) return "small";
  return "medium";
}

const WORK_TYPES = ["feature", "bug", "docs", "chore", "refactor"];

/**
 * The change type: release or sync for a PR from main; otherwise the title's Conventional-Commit type
 * (titles follow the commit format, see CLAUDE.md); otherwise the PR template the body follows.
 * Null when none of them decides.
 * @param {Pick<PullRequest, "title" | "head" | "base" | "body">} pr
 * @param {Record<string, string>} commitPrefixToType from types.json
 * @param {Record<string, string>} [templates] PR type -> template Markdown, for the body fallback
 */
export function typeOf(pr, commitPrefixToType, templates) {
  if (pr.head === "main") return kindOfMainPr(pr.base);
  const prefix = parsePrefix(pr.title)?.prefix;
  if (prefix && commitPrefixToType[prefix]) return commitPrefixToType[prefix];
  if (!templates?.feature || !pr.body) return null;
  const work = detectPrType(pr.body, templates).candidates.filter((t) => WORK_TYPES.includes(t));
  if (work.length === 1) return work[0];
  // No type-specific headings: a feature, but only if the body really follows the feature template.
  const present = new Set(sectionsOf(pr.body).map((x) => x.heading.trim().toLowerCase()));
  const feature = headingsOf(templates.feature).map((h) => h.trim().toLowerCase());
  return work.length === 0 && feature.every((h) => present.has(h)) ? "feature" : null;
}

/**
 * The labels the labeller manages, and the changes that bring a PR in line with them. Labels outside
 * the managed set (team labels, flags, priority) are never touched. A closed or merged PR loses its
 * status labels and keeps its type and size.
 * @param {PullRequest} pr
 * @param {{
 *   status: string[],
 *   types: Record<string, { githubLabel: string | null }>,
 *   commitPrefixToType: Record<string, string>,
 *   sizes: string[],
 *   templates?: Record<string, string>,
 * }} config status: the labels.json "status" group; sizes: the "size" group; templates: PR templates
 */
export function labelChanges(pr, config) {
  const typeLabels = Object.values(config.types)
    .map((t) => t.githubLabel)
    .filter(Boolean);
  const managed = new Set([...config.status, ...typeLabels, ...config.sizes]);

  /** @type {Set<string>} */
  const want = new Set();
  /** @type {Set<string>} labels whose group the labeller decided, so others in the group go */
  const decided = new Set();

  // Status labels are always decided: set on open PRs, cleared from closed ones.
  for (const l of config.status) decided.add(l);
  if (pr.state === "OPEN") {
    if (isStacked(pr.base)) want.add("stackpile");
    want.add(`waiting-on.${waitingOn(pr)}`);
  }

  const type = typeOf(pr, config.commitPrefixToType, config.templates);
  const typeLabel = type ? config.types[type]?.githubLabel : null;
  if (typeLabel) {
    for (const l of typeLabels) decided.add(l);
    want.add(typeLabel);
  }

  if (pr.head !== "main") {
    for (const l of config.sizes) decided.add(l);
    want.add(`size:${sizeOf(pr)}`);
  }

  const has = new Set(pr.labels);
  return {
    add: [...want].filter((l) => managed.has(l) && !has.has(l)).sort(),
    remove: pr.labels.filter((l) => decided.has(l) && !want.has(l)).sort(),
  };
}
