# Course

Information for participants of the hackathon: how we work, how progress is tracked and how the results are evaluated.

## Meeting

During the hackathon we use this Google Meet room:

**https://meet.google.com/qca-ueup-nmr**

## Ground rules

- **Everything in English:** code, comments, commit messages, issues, pull requests and documentation.
- **AI first:** use AI agents for as much of the work as possible.
- **Your own folder:** each team works only in its own folder under `games/` (`games/team-1/`, `games/team-2/`, ...).

## Teams

Every issue and pull request carries exactly one team label:

| Label               | Who               | Folder          |
|---------------------|-------------------|-----------------|
| `team-1` … `team-4` | the game teams    | `games/team-N/` |
| `platform`          | the platform team | `server/`       |
| `team-instructor`   | the instructors   | `course/`       |

## Tracking progress

We track progress with GitHub issues and pull requests.

1. **Issue first, then work.** Before you start a piece of work, open an issue:
   - Title starts with your team label: `[team-2] Short description`, `[team-instructor] ...`
   - Describe the **goal** and the **done when** criteria (a short checklist).
   - Add your team label and assign the issue to whoever works on it.
2. **Every pull request closes an issue.** Put `Closes #<issue number>` in the PR description, so the issue is closed automatically when the PR is merged.
   - New PRs start from the [pull request template](../.github/pull_request_template.md). Fill in every section (linked issue, team, summary, how to test, screenshots) and tick the checklist. Don't delete or rename the headings: the evaluation reads them.
   - The full workflow (branch names, labels, reviews) is in [AGENTS.md](../AGENTS.md).

## Evaluation

At the end of the hackathon the results are evaluated with the help of AI, based on each team's issues, pull requests and commits. The main criteria:

- **Delivery:** how much of what you planned got done (closed issues with merged PRs).
- **Result:** the state of the game: does it run, how complete it is.
- **Process:** clean workflow: clear issues, small PRs, meaningful descriptions.
- **Collaboration:** contributions spread across the team members.

Only work that is visible in this repository counts, so keep your issues and PRs up to date.
