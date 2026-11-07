import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectEvidence, formatEvidence } from "./evidence.mjs";

describe("qa:evidence", () => {
  it("reports changed tests, results, scenarios, and replay ids", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "qa-evidence-"));
    await mkdir(join(cwd, ".qa"), { recursive: true });
    await mkdir(join(cwd, "replays"), { recursive: true });
    await writeFile(
      join(cwd, ".qa", "last-test.json"),
      JSON.stringify({ numPassedTests: 3, numFailedTests: 1 }),
    );
    await writeFile(
      join(cwd, "replays", "room.json"),
      JSON.stringify({ roomId: "room-1", scenario: "sample" }),
    );
    const git = (args: string[]) => {
      if (args[0] === "merge-base") return "base";
      if (args[0] === "ls-files") return "tests/qa/untracked.test.ts";
      if (args.includes("--cached")) return "tests/qa/staged.spec.ts";
      if (args.includes("base")) return "tests/qa/committed.test.ts\nREADME.md";
      return "tests/qa/unstaged.test.ts";
    };
    const evidence = await collectEvidence({ cwd, git });
    expect(evidence).toEqual({
      base: "upstream/main",
      assertedBy: [
        "tests/qa/committed.test.ts",
        "tests/qa/staged.spec.ts",
        "tests/qa/unstaged.test.ts",
        "tests/qa/untracked.test.ts",
      ],
      lastTestResults: { passed: 3, failed: 1 },
      scenarios: ["sample"],
      replayIds: ["room-1"],
    });
    expect(formatEvidence(evidence)).toContain("Asserted by:\n- tests/qa/committed.test.ts");
    expect(formatEvidence(evidence)).toContain("3 passed, 1 failed");
  });

  it("uses origin/main in a real repository when upstream is unavailable", async () => {
    const root = await mkdtemp(join(tmpdir(), "qa-evidence-real-"));
    const seed = join(root, "seed");
    const origin = join(root, "origin.git");
    const cwd = join(root, "work");
    const git = (args: string[], directory: string) =>
      execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();
    try {
      await mkdir(seed, { recursive: true });
      git(["init", "-b", "main"], seed);
      git(["config", "user.email", "qa@example.test"], seed);
      git(["config", "user.name", "QA"], seed);
      await writeFile(join(seed, "README.md"), "base\n");
      git(["add", "."], seed);
      git(["commit", "-m", "base"], seed);
      git(["clone", "--bare", seed, origin], root);
      git(["clone", origin, cwd], root);
      git(["checkout", "-b", "feature"], cwd);
      await writeFile(join(cwd, "changed.test.ts"), "test\n");
      git(["add", "."], cwd);
      git(["commit", "-m", "test"], cwd);

      const evidence = await collectEvidence({ cwd });
      expect(evidence.base).toBe("origin/main");
      expect(evidence.assertedBy).toEqual(["changed.test.ts"]);
      expect(formatEvidence(evidence)).toContain("Compared against origin/main");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports a clear error when no comparison base exists", async () => {
    const git = (args: string[]) => {
      if (args[0] === "rev-parse") throw new Error("raw git error");
      throw new Error(`unexpected git call: ${args.join(" ")}`);
    };
    await expect(collectEvidence({ cwd: "/tmp", git })).rejects.toThrow(
      "Could not find a comparison base (upstream/main, origin/main, or main). Run git fetch or add an upstream remote",
    );
  });
});
