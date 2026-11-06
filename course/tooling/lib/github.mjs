// Reading from GitHub with the GitHub CLI, shared by the course tooling scripts.
import { execFileSync } from "node:child_process";
import { EXIT } from "../../../server/tooling/workflow/lib/args.mjs";

/** Prints a clear message and exits with the "environment problem" code. */
function fail(message) {
  console.error(message);
  process.exit(EXIT.environment);
}

/**
 * Runs a GraphQL query with the GitHub CLI.
 * @param {string} root working directory (the repo root)
 * @param {string} query
 * @param {Record<string, string | number | null>} variables
 */
export function graphql(root, query, variables) {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [k, v] of Object.entries(variables)) if (v !== null) args.push("-F", `${k}=${v}`);
  try {
    return JSON.parse(execFileSync("gh", args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 })).data;
  } catch (err) {
    return fail(
      `error: could not read from GitHub with the GitHub CLI (installed and logged in with "gh auth login"?): ${err.stderr?.toString().trim() || err.message}`,
    );
  }
}

/** Reads every page of a connection. `pick` returns the connection from a query result. */
export function paginate(root, query, variables, pick) {
  const nodes = [];
  let cursor = null;
  do {
    const conn = pick(graphql(root, query, { ...variables, cursor }));
    nodes.push(...conn.nodes);
    cursor = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
  } while (cursor);
  return nodes;
}

/** The "owner/name" of the repository the working directory belongs to. */
export function currentRepo(root) {
  try {
    return execFileSync("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch (err) {
    return fail(`error: could not find the repository (pass --repo owner/name): ${err.message}`);
  }
}
