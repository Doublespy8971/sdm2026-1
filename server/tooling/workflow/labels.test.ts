// Tests for the label scheme (labels.json, labels:sync) and the PR labeller (labels:prs).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allLabels, labelsOf, planLabelSync } from "./lib/labels.mjs";
import { isStacked, labelChanges, sizeOf, typeOf, waitingOn } from "./lib/pr-labels.mjs";

const root = new URL("../../../", import.meta.url);
const read = (rel: string) => readFileSync(new URL(rel, root), "utf8");
const scheme = JSON.parse(read("server/tooling/workflow/labels.json"));
const types = JSON.parse(read("server/tooling/workflow/types.json"));
const templates = Object.fromEntries(
  Object.entries(types.types as Record<string, { prTemplate: string | null }>)
    .filter(([, t]) => t.prTemplate)
    .map(([type, t]) => [type, read(t.prTemplate as string)]),
);
const config = {
  status: labelsOf(scheme, "status"),
  sizes: labelsOf(scheme, "size"),
  types: types.types,
  commitPrefixToType: types.commitPrefixToType,
  templates,
};

describe("labels.json", () => {
  it("has unique names, 6-digit colours and a description for every label", () => {
    const labels = allLabels(scheme);
    expect(new Set(labels.map((l: { name: string }) => l.name)).size).toBe(labels.length);
    for (const l of labels) {
      expect(l.color, l.name).toMatch(/^[0-9a-f]{6}$/);
      expect(l.description.length, l.name).toBeGreaterThan(0);
      expect(l.description.length, l.name).toBeLessThanOrEqual(100);
    }
  });

  it("defines a type label for every type in types.json, and the team labels it knows", () => {
    const names = new Set(allLabels(scheme).map((l: { name: string }) => l.name));
    for (const [type, t] of Object.entries(types.types as Record<string, { githubLabel: string }>)) {
      expect(names.has(t.githubLabel), type).toBe(true);
    }
    expect(labelsOf(scheme, "team")).toEqual(types.teamLabels);
  });

  it("every issue template applies its type label", () => {
    for (const [type, t] of Object.entries(
      types.types as Record<string, { issueTemplate: string | null; githubLabel: string }>,
    )) {
      if (!t.issueTemplate) continue;
      expect(read(t.issueTemplate), type).toMatch(new RegExp(`^labels: ${t.githubLabel}$`, "m"));
    }
  });
});

describe("planLabelSync", () => {
  const def = (name: string, renamedFrom?: string[]) => ({
    name,
    color: "aaaaaa",
    description: name,
    renamedFrom,
  });
  const repo = (name: string, color = "aaaaaa", description = name) => ({ name, color, description });

  it("creates, updates, renames and deletes", () => {
    const plan = planLabelSync(
      {
        groups: [{ labels: [def("type:feature", ["enhancement"]), def("team-1"), def("size:tiny")] }],
        remove: ["question", "absent"],
      },
      [repo("enhancement", "a2eeef", "old"), repo("team-1", "ffffff"), repo("question"), repo("keep-me")],
    );
    expect(
      plan.map((c: { action: string; name: string; from?: string }) => [c.action, c.from ?? "", c.name]),
    ).toEqual([
      ["rename", "enhancement", "type:feature"],
      ["update", "", "team-1"],
      ["create", "", "size:tiny"],
      ["delete", "", "question"],
    ]);
  });

  it("is empty when the repo already matches, and matches names case-insensitively", () => {
    expect(planLabelSync({ groups: [{ labels: [def("bug")] }] }, [repo("Bug", "aaaaaa", "bug")])).toEqual([]);
  });

  it("doesn't delete a label it is renaming", () => {
    const plan = planLabelSync({ groups: [{ labels: [def("type:bug", ["bug"])] }], remove: ["bug"] }, [
      repo("bug"),
    ]);
    expect(plan.map((c: { action: string }) => c.action)).toEqual(["rename"]);
  });
});

describe("waitingOn", () => {
  const pr = (over = {}) => ({ isDraft: false, author: "ana", reviews: [], unresolvedThreads: 0, ...over });

  it("waits on review until someone other than the author approves", () => {
    expect(waitingOn(pr())).toBe("review");
    expect(waitingOn(pr({ reviews: [{ author: "ana", state: "APPROVED" }] }))).toBe("review");
    expect(waitingOn(pr({ reviews: [{ author: "ben", state: "COMMENTED" }] }))).toBe("review");
    expect(waitingOn(pr({ reviews: [{ author: "ben", state: "APPROVED" }] }))).toBe("merge");
  });

  it("waits on the author for changes requested, an unresolved thread or a draft", () => {
    expect(waitingOn(pr({ reviews: [{ author: "ben", state: "CHANGES_REQUESTED" }] }))).toBe("author");
    expect(waitingOn(pr({ reviews: [{ author: "ben", state: "APPROVED" }], unresolvedThreads: 1 }))).toBe(
      "author",
    );
    expect(waitingOn(pr({ isDraft: true, reviews: [{ author: "ben", state: "APPROVED" }] }))).toBe("author");
  });

  it("uses each reviewer's latest decision, ignoring later comments", () => {
    const changed = [
      { author: "ben", state: "CHANGES_REQUESTED" },
      { author: "ben", state: "APPROVED" },
      { author: "ben", state: "COMMENTED" },
    ];
    expect(waitingOn(pr({ reviews: changed }))).toBe("merge");
    const dismissed = [
      { author: "ben", state: "APPROVED" },
      { author: "ben", state: "DISMISSED" },
    ];
    expect(waitingOn(pr({ reviews: dismissed }))).toBe("review");
    const mixed = [
      { author: "ben", state: "APPROVED" },
      { author: "cy", state: "CHANGES_REQUESTED" },
    ];
    expect(waitingOn(pr({ reviews: mixed }))).toBe("author");
  });
});

describe("isStacked", () => {
  it("is true only for bases that aren't main, prod or a feature branch", () => {
    for (const base of ["main", "prod", "feature/team-1", "feature/team-4"])
      expect(isStacked(base), base).toBe(false);
    for (const base of ["team-1/23-time-loop", "platform/10-checks", "feature/team-9"])
      expect(isStacked(base), base).toBe(true);
  });
});

describe("sizeOf", () => {
  const pr = (lines: number, files: string[]) => ({ additions: lines, deletions: 0, files });

  it("sizes by changed lines and files", () => {
    expect(sizeOf(pr(20, ["a.ts", "b.ts"]))).toBe("tiny");
    expect(sizeOf(pr(20, ["a.ts", "b.ts", "c.ts"]))).toBe("small");
    expect(sizeOf(pr(150, ["a.ts"]))).toBe("small");
    expect(sizeOf(pr(151, ["a.ts"]))).toBe("medium");
    expect(sizeOf(pr(400, ["a.ts"]))).toBe("medium");
    expect(sizeOf(pr(401, ["a.ts"]))).toBe("large");
  });

  it("treats contract, dependency and CI changes as large, but not their tests", () => {
    expect(sizeOf(pr(2, ["server/core/src/shared/messages.ts"]))).toBe("large");
    expect(sizeOf(pr(2, ["games/team-1/package.json"]))).toBe("large");
    expect(sizeOf(pr(2, ["pnpm-lock.yaml"]))).toBe("large");
    expect(sizeOf(pr(2, [".github/workflows/ci.yml"]))).toBe("large");
    expect(sizeOf(pr(2, ["server/core/src/shared/contract.test.ts"]))).toBe("tiny");
  });
});

describe("typeOf", () => {
  const pr = (title: string, over = {}) => ({
    title,
    head: "team-2/1-x",
    base: "feature/team-2",
    body: "",
    ...over,
  });

  it("reads the Conventional-Commit type from the title", () => {
    expect(typeOf(pr("feat(team-2): add login"), types.commitPrefixToType)).toBe("feature");
    expect(typeOf(pr("fix(team-2): stop the loop"), types.commitPrefixToType)).toBe("bug");
    expect(typeOf(pr("ci(platform): cache pnpm"), types.commitPrefixToType)).toBe("chore");
  });

  it("uses the base for PRs from main", () => {
    expect(
      typeOf(pr("chore(platform): release", { head: "main", base: "prod" }), types.commitPrefixToType),
    ).toBe("release");
    expect(typeOf(pr("x", { head: "main", base: "feature/team-1" }), types.commitPrefixToType)).toBe("sync");
  });

  it("falls back to the template the body follows, and otherwise decides nothing", () => {
    expect(
      typeOf(pr("[team-2] Add login", { body: templates.bug }), types.commitPrefixToType, templates),
    ).toBe("bug");
    expect(
      typeOf(pr("[team-2] Add login", { body: templates.feature }), types.commitPrefixToType, templates),
    ).toBe("feature");
    expect(
      typeOf(pr("[team-2] Add login", { body: "Just some text" }), types.commitPrefixToType, templates),
    ).toBeNull();
  });
});

describe("labelChanges", () => {
  const open = {
    number: 1,
    state: "OPEN" as const,
    isDraft: false,
    title: "feat(team-2): add login",
    body: "",
    author: "ana",
    base: "feature/team-2",
    head: "team-2/1-login",
    labels: ["team-2"],
    reviews: [],
    unresolvedThreads: 0,
    additions: 10,
    deletions: 0,
    files: ["games/team-2/a.ts"],
  };

  it("adds status, type and size to a new PR and never touches other labels", () => {
    expect(labelChanges(open, config)).toEqual({
      add: ["size:tiny", "type:feature", "waiting-on.review"],
      remove: [],
    });
  });

  it("swaps the waiting label when the state changes, and adds stackpile for a stacked PR", () => {
    const pr = {
      ...open,
      base: "team-2/1-login",
      labels: ["team-2", "type:feature", "size:tiny", "waiting-on.review"],
      reviews: [{ author: "ben", state: "APPROVED" }],
    };
    expect(labelChanges(pr, config)).toEqual({
      add: ["stackpile", "waiting-on.merge"],
      remove: ["waiting-on.review"],
    });
  });

  it("replaces a wrong type or size label", () => {
    const pr = { ...open, labels: ["team-2", "type:docs", "size:large", "waiting-on.review"] };
    expect(labelChanges(pr, config)).toEqual({
      add: ["size:tiny", "type:feature"],
      remove: ["size:large", "type:docs"],
    });
  });

  it("clears status labels from closed PRs and keeps type and size", () => {
    const pr = {
      ...open,
      state: "MERGED" as const,
      labels: ["team-2", "type:feature", "size:tiny", "stackpile", "waiting-on.merge", "cross-team"],
    };
    expect(labelChanges(pr, config)).toEqual({ add: [], remove: ["stackpile", "waiting-on.merge"] });
  });

  it("leaves the type alone when nothing decides it, and gives PRs from main no size", () => {
    const untyped = { ...open, title: "[team-2] Add login", labels: ["team-2", "type:docs"] };
    expect(labelChanges(untyped, config).remove).not.toContain("type:docs");
    const sync = { ...open, head: "main", base: "feature/team-2", labels: ["team-2", "size:large"] };
    expect(labelChanges(sync, config)).toEqual({ add: ["type:sync", "waiting-on.review"], remove: [] });
  });
});
