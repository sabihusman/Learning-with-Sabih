# Infrastructure notes

This file exists to stop the project's infra documentation from silently misleading. It
records a known discrepancy between the documented server and the running one. It does not
describe the real production server, because that configuration has not been captured.

## Deploy target

The site is a static Next.js export. On every push to `main`, the GitHub Actions workflow
`.github/workflows/deploy.yml` ("Deploy to Hetzner") builds the export and rsyncs the `./out`
directory over SSH to a Hetzner box, then runs a verify step that expects HTTP 200.

## The discrepancy: documented Caddy vs running nginx

The project has infra files that describe a Caddy-based setup: a `Caddyfile`, a
`DEPLOY-RUNBOOK.md`, and a `server-bootstrap.sh`. Those files are NOT tracked in this repo.
They exist only outside version control (in the Claude project), so they are not visible or
reviewable here.

Verified this session: the production box actually serves `nginx/1.24.0 (Ubuntu)`, not Caddy.
That was confirmed from the server response header when checking the live site.

So the Caddy-based infra files do not match the running server. They must not be treated as
an accurate description of the live box until this is reconciled.

## What is NOT captured here

The real nginx configuration has not been captured. We do not have it, so this file does not
reproduce, describe, or guess any nginx directives, server blocks, or settings. Nothing here
should be read as how the live server is configured.

## To reconcile later

- Capture the real nginx configuration from the production box.
- Decide whether the server should be Caddy (matching the existing infra files) or nginx
  (matching what is running), then make the docs and the server agree.
- Bring whichever infra files are the source of truth into this repo so they are tracked and
  reviewable, instead of living outside version control.
