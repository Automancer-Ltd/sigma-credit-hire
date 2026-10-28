# sigma-credit-hire

One-page marketing site for Sigma Credit Hire (credit hire and replacement vehicles, Bolton), served at
https://sigmacredithire.co.uk by GitHub Pages straight from `main`. No build step, no framework, no backend,
no forms.

## Where things live

- `index.html`: the whole page. `styles.css`: its styles. `fonts/` (Inter, self-hosted), `images/` (hero in WebP).
- `revision.json`: Jekyll writes the served commit into it (`{"revision": "<sha>"}`). `deploy.json` tells
  Guardian's served-vs-main check to read it.
- `_config.yml` keeps `AGENTS.md`, `README.md` and `scripts/` off the public site.
- Draft PR #5 (design pass) is Waseem's to decide; do not merge it unasked. The contrast fix (#9) landed with Waseem's approval (d559).

## Commands

- `scripts/check` is the one check and what CI runs: it serves the checkout and fails on WCAG 2.2 A/AA
  violations (axe-core) at 1280 px and 320 px. Heavy (it downloads Chromium): `/opt/automancer/bin/heavy -- scripts/check`.
- `scripts/verify-live` runs after a merge: waits for Pages to serve the merged SHA, then runs the same check
  against production. Merge-to-live is about a minute.
- `git config core.hooksPath .githooks` turns on the secret-scan hooks in a fresh clone.

## Release

Merging to `main` is the release: Pages builds and serves it. Verify with `scripts/verify-live`; the step is
`.agents/skills/verify-sigma/SKILL.md`.

## Observability

- Uptime: `obs uptime | grep -i sigma` (UptimeRobot monitor 804357869 on `/revision.json`, 5 minutes).
- Errors: none. The page runs no application code of its own, so there is nothing to report.
- Served version: `curl -fsS https://sigmacredithire.co.uk/revision.json`.

For release verification and rollback procedures, see [README.md](README.md).
