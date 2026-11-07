import { describe, expect, it } from "vitest";
import { addIssueRef, hooksPathAction, issueFromBranch } from "./lib/hooks.mjs";

describe("issueFromBranch", () => {
  it("reads the issue number from a work branch", () => {
    expect(issueFromBranch("team-2/14-add-login")).toBe(14);
    expect(issueFromBranch("platform/152-git-hooks")).toBe(152);
    expect(issueFromBranch("team-instructor/3-x")).toBe(3);
  });
  it("returns null for anything else", () => {
    for (const b of ["main", "prod", "feature/team-2", "HEAD", "my-branch", "team-9/1-x"])
      expect(issueFromBranch(b)).toBeNull();
  });
});

describe("addIssueRef", () => {
  const branch = "team-2/14-add-login";

  it("adds Refs #N as its own paragraph when the message has none", () => {
    expect(addIssueRef("feat(team-2): add login\n", branch)).toBe("feat(team-2): add login\n\nRefs #14\n");
    expect(addIssueRef("feat(team-2): add login\n\nPlayers need accounts.\n", branch)).toBe(
      "feat(team-2): add login\n\nPlayers need accounts.\n\nRefs #14\n",
    );
  });

  it("leaves a message that already references an issue alone", () => {
    for (const msg of ["feat: x\n\nRefs #3\n", "fix: y\n\nCloses #14\n", "fix: y\n\nFixes #2\n"])
      expect(addIssueRef(msg, branch)).toBe(msg);
  });

  it("leaves merges, reverts, fixups and empty messages alone", () => {
    for (const msg of [
      "Merge branch 'main' into team-2/14-add-login\n",
      'Revert "feat: x"\n',
      "fixup! feat: x\n",
      "squash! feat: x\n",
      "",
      "# only a comment\n",
    ])
      expect(addIssueRef(msg, branch)).toBe(msg);
  });

  it("does nothing off a work branch", () => {
    expect(addIssueRef("feat: x\n", "main")).toBe("feat: x\n");
  });

  it("keeps trailers last, after the reference", () => {
    expect(addIssueRef("feat: x\n\nBody.\n\nCo-Authored-By: A <a@b.c>\n", branch)).toBe(
      "feat: x\n\nBody.\n\nRefs #14\n\nCo-Authored-By: A <a@b.c>\n",
    );
    expect(addIssueRef("feat: x\n\nCo-Authored-By: A <a@b.c>\nSigned-off-by: B <b@c.d>\n", branch)).toBe(
      "feat: x\n\nRefs #14\n\nCo-Authored-By: A <a@b.c>\nSigned-off-by: B <b@c.d>\n",
    );
  });

  it("puts the reference before git's comment lines, so the editor template still works", () => {
    const edited =
      "feat: x\n\n# Please enter the commit message for your changes.\n# On branch team-2/14-add-login\n";
    expect(addIssueRef(edited, branch)).toBe(
      "feat: x\n\nRefs #14\n\n# Please enter the commit message for your changes.\n# On branch team-2/14-add-login\n",
    );
  });

  it("keeps CRLF messages working", () => {
    expect(addIssueRef("feat: x\r\n", branch)).toBe("feat: x\n\nRefs #14\n");
  });
});

describe("hooksPathAction", () => {
  it("sets the path when it's unset or already ours", () => {
    expect(hooksPathAction({ isGitCheckout: true, current: null, ci: false })).toBe("set");
    expect(hooksPathAction({ isGitCheckout: true, current: ".githooks", ci: false })).toBe("already");
  });
  it("never overrides someone else's hooks path", () => {
    expect(hooksPathAction({ isGitCheckout: true, current: "~/.my-hooks", ci: false })).toBe("foreign");
  });
  it("skips outside a git checkout (e.g. a Railway build) and in CI", () => {
    expect(hooksPathAction({ isGitCheckout: false, current: null, ci: false })).toBe("skip");
    expect(hooksPathAction({ isGitCheckout: true, current: null, ci: true })).toBe("skip");
  });
});
