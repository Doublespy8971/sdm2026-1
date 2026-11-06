// `node course/tooling/issue-report.mjs`: lists, per team, which issues break the naming and labelling
// rules (exactly one team label, and a title that starts with the same `[<team-label>]`), and why. Reads
// the issues from GitHub with the GitHub CLI, then runs the rules in lib/issue-report.mjs, which reuse
// `pnpm check:issue`.
//
//   node course/tooling/issue-report.mjs                        every issue (open and closed), as Markdown
//   node course/tooling/issue-report.mjs --state open           only open issues (also: closed, all)
//   node course/tooling/issue-report.mjs --team team-2           only one team
//   node course/tooling/issue-report.mjs --failing               leave out the passing issues
//   node course/tooling/issue-report.mjs --json                  machine-readable output
//   node course/tooling/issue-report.mjs --repo owner/name       another repository than the current one
//
// Exit codes: 0 report written, 2 usage error, 3 environment problem (gh missing or not logged in).
import { fileURLToPath } from "node:url";
import { EXIT, parseArgs } from "../../server/tooling/workflow/lib/args.mjs";
import { loadTypes } from "../../server/tooling/workflow/lib/types.mjs";
import { currentRepo, paginate } from "./lib/github.mjs";
import { auditIssue, formatReport, groupByTeam } from "./lib/issue-report.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const { flags } = parseArgs(process.argv.slice(2), { boolean: ["json", "failing"] });
const str = (name) => (typeof flags[name] === "string" ? flags[name] : null);

const STATES = { open: ["OPEN"], closed: ["CLOSED"], all: ["OPEN", "CLOSED"] };
const state = str("state") ?? "all";
const config = loadTypes(root);
const team = str("team");
if (!STATES[state] || (team && !config.teamLabels.includes(team))) {
  console.error(
    `usage: node course/tooling/issue-report.mjs [--state ${Object.keys(STATES).join("|")}] [--team ${config.teamLabels.join("|")}] [--failing] [--json] [--repo owner/name]`,
  );
  process.exit(EXIT.usage);
}

const repo = str("repo") ?? currentRepo(root);
const [owner, name] = repo.split("/");

const nodes = paginate(
  root,
  `query($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      issues(first: 100, after: $cursor, states: [${STATES[state].join(", ")}], orderBy: { field: CREATED_AT, direction: DESC }) {
        pageInfo { hasNextPage endCursor }
        nodes {
          number title url state
          author { login }
          labels(first: 30) { nodes { name } }
        }
      }
    }
  }`,
  { owner, name },
  (d) => d.repository.issues,
);

let results = nodes.map((i) =>
  auditIssue({
    issue: {
      number: i.number,
      title: i.title,
      url: i.url,
      state: i.state,
      author: i.author?.login ?? "ghost",
      labels: i.labels.nodes.map((l) => l.name),
    },
    config,
  }),
);
if (team) results = results.filter((r) => r.team === team);

const failingOnly = flags.failing === true;
const groups = groupByTeam(results, config.teamLabels)
  .map((g) => (failingOnly ? { ...g, passing: [] } : g))
  .filter((g) => !failingOnly || g.failCount > 0);

if (flags.json === true) {
  console.log(JSON.stringify({ repo, state, generatedAt: new Date().toISOString(), teams: groups }, null, 2));
} else {
  const generatedAt = `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;
  process.stdout.write(formatReport(groups, { repo, state, generatedAt, failingOnly }));
}
process.exit(EXIT.ok);
