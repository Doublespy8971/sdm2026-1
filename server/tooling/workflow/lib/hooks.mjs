// The rules behind the git hooks in .githooks/: which issue a branch belongs to, adding its reference to
// a commit message, and whether `pnpm install` may point git at the hooks. Pure, so every rule is
// unit-tested; the hook scripts do the I/O.
import { EXEMPT, ISSUE_REFERENCE } from "./check-commit.mjs";
import { WORK_BRANCH } from "./rules.mjs";

/** The folder the hooks live in, relative to the repository root. */
export const HOOKS_PATH = ".githooks";

const TRAILER = /^[A-Za-z][A-Za-z0-9-]*: \S/;
const isBlankOrComment = (line) => line.trim() === "" || line.startsWith("#");

/**
 * The issue number in a work branch name (`team-2/14-add-login` → 14), or null for any other branch.
 * @param {string} branch
 */
export function issueFromBranch(branch) {
  const m = WORK_BRANCH.exec(branch);
  return m ? Number(m[2]) : null;
}

/**
 * Adds "Refs #N" for the branch's issue when the message has no issue reference yet. Leaves the message
 * unchanged off a work branch, for messages git generates (merges, reverts, fixups) and when a reference
 * is already there. The reference goes in its own paragraph, before any trailers (Co-Authored-By: …) and
 * before git's "#" comment lines.
 * @param {string} message the commit message file's content
 * @param {string} branch the current branch
 * @returns {string}
 */
export function addIssueRef(message, branch) {
  const issue = issueFromBranch(branch);
  if (issue === null) return message;

  const lines = message.replace(/\r\n/g, "\n").split("\n");
  let end = lines.length;
  while (end > 0 && isBlankOrComment(lines[end - 1])) end--;
  const content = lines.slice(0, end).filter((l) => !l.startsWith("#"));
  const comments = lines.slice(end).filter((l) => l.startsWith("#"));

  const subject = content.find((l) => l.trim() !== "") ?? "";
  if (subject === "" || EXEMPT.test(subject) || ISSUE_REFERENCE.test(content.join("\n"))) return message;

  const lastBlank = content.lastIndexOf("");
  const lastParagraph = lastBlank === -1 ? [] : content.slice(lastBlank + 1);
  const ref = `Refs #${issue}`;
  const body =
    lastParagraph.length > 0 && lastParagraph.every((l) => TRAILER.test(l))
      ? [...content.slice(0, lastBlank), "", ref, "", ...lastParagraph]
      : [...content, "", ref];

  const text = `${body.join("\n")}\n`;
  return comments.length > 0 ? `${text}\n${comments.join("\n")}\n` : text;
}

/**
 * What `pnpm install` should do about git's hooks path.
 * @param {{ isGitCheckout: boolean, current: string | null, ci: boolean }} state
 * @returns {"set" | "already" | "foreign" | "skip"}
 */
export function hooksPathAction({ isGitCheckout, current, ci }) {
  if (!isGitCheckout || ci) return "skip";
  if (!current) return "set";
  return current === HOOKS_PATH ? "already" : "foreign";
}
