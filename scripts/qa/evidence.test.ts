import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
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
});
