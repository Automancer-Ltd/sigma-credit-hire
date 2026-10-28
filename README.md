# Sigma Credit Hire site — operator guide

The site is a static, one-page GitHub Pages site at <https://sigmacredithire.co.uk/>. GitHub Pages publishes from `main`; merging a change to `main` is the production release. There is no application server or separate deployment command.

## Before release

1. Make and review the change on a branch and open a pull request. Do not edit `main` directly.
2. Require the repository's CI check (`scripts/check`) to pass. It checks WCAG 2.2 A/AA at desktop (1280 px) and mobile (320 px).
3. For local verification, run `/opt/automancer/bin/heavy -- scripts/check` (or `scripts/check` where Chromium is available).
4. Merge the approved PR to `main`. GitHub Pages normally serves the new revision in about a minute.

## Verify production

Run `scripts/verify-live` after the merge. It waits for `revision.json` on the live site to report the merged commit, then runs the same accessibility check against production; a non-zero exit means the release has not been verified. Check the served SHA directly with:

```sh
curl -fsS https://sigmacredithire.co.uk/revision.json
```

Compare `revision` with the commit intended for release. Also confirm the home page responds successfully. Do not report a release as live until the revision and live check pass.

## Roll back a failed release

Rollback by reverting the faulty change through a new pull request. Do not force-push, reset `main`, or amend published history.

1. Identify the bad commit (or commits) from `revision.json` and the merged PR. If the live revision is not the bad commit yet, first determine whether Pages is still publishing; do not revert unrelated changes.
2. On a new branch from current `main`, revert the faulty merge commit, preserving any later unrelated changes:

   ```sh
   git switch -c rollback/<short-description> origin/main
   git revert -m 1 <merge-commit-sha>
   ```

   For a non-merge commit use `git revert <commit-sha>`. If the revert conflicts or would undo later work, stop and resolve with the relevant maintainers rather than force-pushing.
3. Open a pull request for the revert and wait for CI to pass; merge it using the repository's normal protected-branch process. The revert itself is the rollback release.
4. Run `scripts/verify-live` for the revert commit. Confirm `revision.json` reports that commit and the live accessibility check passes. If it does not, record the observed revision and investigate Pages publication; do not claim rollback complete.

Because this is a static site, there is no server-side state or database rollback. A subsequent corrective release can be made through the same PR and verification process.

## Monitoring

- Uptime monitor: `obs uptime | grep -i sigma` (monitor 804357869 checks `/revision.json` every five minutes).
- The page has no application code or backend; there are no application error logs to inspect.
- Repository-specific accessibility and live-verification details: [verify-sigma skill](.agents/skills/verify-sigma/SKILL.md).
