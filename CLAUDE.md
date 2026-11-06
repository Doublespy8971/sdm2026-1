# Repository rules

> This file is the single source of truth for how everyone (humans and AI agents) works in this repository. `AGENTS.md` only points here. Change the rules here, through a reviewed PR.

These rules apply to every agent (and every human) working in this repository. They are not optional: if a change does not follow this workflow, it does not get merged.

## Repository layout

| Folder          | Owner       | Label             |
|-----------------|-------------|-------------------|
| `games/team-1/` | Team 1      | `team-1`          |
| `games/team-2/` | Team 2      | `team-2`          |
| `games/team-3/` | Team 3      | `team-3`          |
| `games/team-4/` | Team 4      | `team-4`          |
| `course/`       | Instructors | `team-instructor` |
| `server/`       | Platform    | `platform`        |

Work inside your own team's folder. Changes to another team's folder or to the shared folders need an issue that says why, and a review from someone on the owning team.

## Workflow

Every change goes through the same path: **issue → branch → commits → pull request → review → merge.** No shortcuts.

### 1. Issue first

- Open an issue before writing any code. No issue, no branch, no PR.
- The issue must carry exactly one team label: `team-1`, `team-2`, `team-3`, `team-4`, `platform` or `team-instructor`. The label says which team owns the work.
- The title starts with the team name: `[team-2] Add login page`.
- Describe what is changing and why, and what "done" looks like.

### 2. Branch

- Never commit directly to `main`. `main` only changes through merged pull requests.
- Branch from an up-to-date `main`.
- Name the branch after the team label and the issue: `<team-label>/<issue-number>-<short-description>`
  - Examples: `team-2/14-add-login-page`, `platform/8-ci-checks`, `team-instructor/20-add-team-instructor-rules`

### 3. Commits

- Keep each commit to one logical change.
- Write the message in the imperative mood ("Add login page", not "Added login page").
- Reference the issue in the commit body, e.g. `Refs #14`.
- Do not commit secrets, credentials, build output or large binaries.

### 4. Pull request

- One pull request per issue.
- Fill in every section of the [pull request template](.github/pull_request_template.md). Don't delete or rename its headings.
- The PR must carry the same team label as its issue.
- The title starts with the team name: `[team-2] Add login page`.
- The description links the issue with a closing keyword (`Closes #14`) and summarizes what changed and how it was tested.
- Keep the PR focused. Unrelated changes go in their own issue and PR.

### 5. Review and merge

- At least one approving review is required before merging. Nobody approves their own PR.
- All checks must pass.
- Resolve every review comment before merging.
- Rebase on or merge in `main` if the branch is behind, then merge.
- Delete the branch after it is merged.

## Never

- Push directly to `main`.
- Force-push to `main` or to someone else's branch.
- Merge a PR without a team label, a linked issue or an approving review.
- Rewrite history that others have already pulled.
