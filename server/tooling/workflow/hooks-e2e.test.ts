// End to end: a throwaway git repository whose core.hooksPath points at this repo's .githooks, so the
// real hook scripts run on real commits.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const hooks = fileURLToPath(new URL("../../../.githooks", import.meta.url));
let dir: string;
const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: "pipe" });
const lastMessage = () => git("log", "-1", "--format=%B");
const commit = (msg: string) => {
  writeFileSync(path.join(dir, `f${Date.now()}${Math.random()}`), "x");
  git("add", "-A");
  return git("commit", "-q", "-m", msg);
};

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "sdm-hooks-"));
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "Test");
  writeFileSync(path.join(dir, "README"), "x");
  git("add", "-A");
  git("commit", "-q", "--no-verify", "-m", "chore: start\n\nRefs #1");
  git("config", "core.hooksPath", hooks);
  git("checkout", "-q", "-b", "team-2/14-add-login");
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("commit-msg hook", () => {
  it("adds Refs #N from the branch name", () => {
    commit("feat(team-2): add login");
    expect(lastMessage().trim()).toBe("feat(team-2): add login\n\nRefs #14");
  });

  it("keeps a reference that's already there", () => {
    commit("fix(team-2): stop the crash\n\nCloses #14");
    expect(lastMessage().trim()).toBe("fix(team-2): stop the crash\n\nCloses #14");
  });

  it("refuses a message that breaks the format, and says why", () => {
    let error = "";
    try {
      commit("Added login");
    } catch (err) {
      error = String((err as { stderr?: string }).stderr);
    }
    expect(error).toContain("does not follow the commit format");
    expect(error).toContain("--no-verify");
    expect(lastMessage().trim()).toBe("fix(team-2): stop the crash\n\nCloses #14");
  });

  it("lets merge commits through untouched", () => {
    git("checkout", "-q", "main");
    commit("chore: start main\n\nRefs #1");
    git("checkout", "-q", "team-2/14-add-login");
    git("merge", "-q", "--no-ff", "main", "-m", "Merge branch 'main' into team-2/14-add-login");
    expect(lastMessage().trim()).toBe("Merge branch 'main' into team-2/14-add-login");
  });

  it("can be skipped with --no-verify", () => {
    writeFileSync(path.join(dir, "skip"), "x");
    git("add", "-A");
    git("commit", "-q", "--no-verify", "-m", "wip");
    expect(lastMessage().trim()).toBe("wip");
  });
});

describe("hook files", () => {
  it("are Node scripts, so they run on every OS without bash", () => {
    for (const name of ["commit-msg", "pre-push"])
      expect(readFileSync(path.join(hooks, name), "utf8").startsWith("#!/usr/bin/env node")).toBe(true);
  });
});

describe("commit-msg hook on a branch with no commits yet", () => {
  it("still finds the issue number", () => {
    const fresh = mkdtempSync(path.join(tmpdir(), "sdm-hooks-unborn-"));
    const g = (...args: string[]) =>
      execFileSync("git", args, { cwd: fresh, encoding: "utf8", stdio: "pipe" });
    try {
      g("init", "-q", "-b", "platform/7-first");
      g("config", "user.email", "t@example.com");
      g("config", "user.name", "Test");
      g("config", "core.hooksPath", hooks);
      writeFileSync(path.join(fresh, "a"), "x");
      g("add", "-A");
      g("commit", "-q", "-m", "chore(platform): first");
      expect(g("log", "-1", "--format=%B").trim()).toBe("chore(platform): first\n\nRefs #7");
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  });
});
