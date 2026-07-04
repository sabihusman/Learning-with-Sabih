# Learning with Sabih: project handoff

This is the current, accurate handoff for the project. It replaces the older
PROJECT-CONTINUATION-PROMPT.md that lived only in the Claude project workspace and
was out of date. All the volatile facts below (section list, counts, stack, CI,
deploy) were read from the real repo, not copied from a prompt.

## What this is

An interactive computer science study guide. Each topic pairs a short piece of
written explanation with one interactive figure that computes and shows the idea for
real. The whole thing is a static Next.js export (plain HTML, CSS, and JavaScript
files), so there is no server-side runtime in production.

This project is BUILT and LIVE. It is not an early prototype. Topics are shipped,
the site is deployed, and new topics are added one at a time through the build loop
described below.

## Live site

https://95.216.159.93/

The site is served from a raw IP address with a non-standard (self-signed or
IP-scoped) TLS certificate, so a browser will likely show a certificate warning. That
is expected for now; see the open issues about the certificate and domain.

## Current scope

Read from app/topicList.js, which is the single source of truth for the ordered topic
list. There are 4 sections and 40 topics total:

- AI and ML: 15 topics
- Algorithms and Data Structures: 10 topics
- Databases and SQL: 11 topics
- Object-Oriented Programming: 4 topics

topicList.js holds a compact delimited table (section, number, title, subtitle, slug),
one row per topic. The contents page and every page's previous/next navigation are
generated from it, so reordering or inserting a topic there updates the whole site.
Inserting a topic in the middle means renumbering the later rows so the numbering stays
sequential.

## Stack and architecture

Read from package.json and next.config.mjs:

- Next.js ^15.3.3, App Router, configured for static export: output 'export',
  trailingSlash true, images unoptimized.
- React 19 and react-dom 19.
- MDX for prose via @next/mdx and @mdx-js. Page extensions include md and mdx, so a
  topic page can be written as MDX and still import a React component.
- anime.js ^4.0.0 for cosmetic animation flourish only, not for teaching progression.
- React Three Fiber for the 3D topics: @react-three/fiber ^9.6.1, @react-three/drei
  ^10.7.7, three ^0.184.0.
- Playwright ^1.60.0 for end-to-end tests.
- ESLint ^9 with eslint-config-next, TypeScript available for the test tooling.
- CI runs on Node 20.

Per-topic anatomy:

- app/topics/<slug>/page.mdx: a metadata export, one H1 in sentence case, the prose,
  and an embed of that topic's interactive component.
- app/components/<Name>Viz.jsx: the interactive component, marked 'use client'. It may
  have a small data module and a CSS module beside it.
- A row in app/topicList.js and a registration in the Playwright specs (e2e/smoke.spec.ts,
  and the AI-and-ML count in e2e/accordion.spec.ts when that section changes).

Every interactive figure plugs into one shared presentational shell,
app/components/Figure.jsx, which renders the eyebrow, title, controls, status line,
readouts, and the "try this" callout. The shell is generic and is not modified for
individual topics.

npm scripts: dev (next dev), build (next build), start (next start), lint (eslint .),
test:e2e (playwright test).

## Deploy

Read from .github/workflows/deploy.yml. The workflow is named "Deploy to Hetzner" and
runs on push to main (and manual dispatch). It builds the static export and rsyncs the
./out directory over SSH to /var/www/study-guide/ on a Hetzner box, then runs a verify
step.

The verify step, in its current form:

    code=$(curl -sS -L -k -o /dev/null -w "%{http_code}" "https://${SITE_DOMAIN}/")
    echo "Final HTTP status (after redirects): $code"

It follows redirects (-L), skips TLS validation (-k), and fails the deploy unless the
final status is 200.

Server discrepancy, verified this session: the production box actually serves
nginx/1.24.0 (Ubuntu). The repo's infra description assumes Caddy. The Caddy files
(Caddyfile, DEPLOY-RUNBOOK.md, server-bootstrap.sh) are NOT tracked in this repo; they
live only in the Claude project workspace and describe a setup that does not match the
running server. Do not trust those Caddy files as a description of production until this
is reconciled. See INFRA-NOTES.md for the same note tracked in the repo.

## Conventions

- app/topicList.js is the single source of truth for topics and ordering. Change topics
  there, not in scattered lists.
- The Figure shell (app/components/Figure.jsx) is shared and must not be modified to suit
  one topic. Topics adapt to the shell, not the other way around.
- Teaching progression that auto-advances must be timer-driven (setInterval plus
  setState), never a requestAnimationFrame chain and never driven off an anime.js
  onComplete, because rAF is throttled in background tabs and would stall the lesson.
  anime.js and CSS transitions are for cosmetic flourish only.
- Branch protection on main requires four checks, referenced by their bare job names:
  build, lint, link-check (all in the CI workflow), and test (the end-to-end workflow).
- Merges are squash merges, keeping a linear history. Do not bypass branch protection.
- "Done" means live in production, not merely merged. A change is finished when the
  Deploy to Hetzner run has succeeded and the live site serves the change.

## The build loop

How a new topic or prose change moves from idea to live:

1. A build prompt describes the topic and the exact figure behavior.
2. Claude Code builds the figure and wiring on a branch, keeping the computation real and
   verifying it, and opens a pull request. The page ships with a clearly marked
   placeholder paragraph at this stage.
3. Prose is drafted separately (in Notion).
4. The draft is finalized against the actual figure with a match-the-build check: every
   factual claim in the prose must match what the figure really does. If a claim does not
   match, the prose is corrected to match the figure, never the reverse.
5. An apply-prose step replaces the placeholder with the finalized prose on the same
   branch.
6. The pull request is merged (squash).
7. The deploy is watched to success and the live page is confirmed to serve the real
   content.

## Known open issues

These are honestly open. None of them is fixed.

- Contents drawer zoom bug. On topic pages, at some browser zoom levels (reported at
  laptop widths), the sticky header and the left "Contents" edge tab both disappear. A
  hardening attempt was merged (PR #77, which added will-change and isolation to the
  header and the tab to keep them on stable compositing layers), but it did NOT confirm a
  fix. The original symptom could not be reproduced in the headless preview, so the
  hardening is unverified against the real report. This is still open.

- Deploy verify uses a -k stopgap. The verify step skips TLS validation with curl -k
  because the site is on a raw IP with a certificate that public certificate authorities
  will not validate. This weakens the check to a liveness gate rather than a trust check.
  The real fix is a proper domain with a valid certificate, after which -k should be
  dropped.

- nginx versus Caddy infra mismatch. As noted under Deploy, production serves nginx but
  the untracked infra files describe Caddy, and the real server configuration is not
  captured in the repo. This needs reconciling, and whichever infra is the source of truth
  should be brought into the repo so it is tracked and reviewable.

- Audit backlog in AUDIT-NOTES.md. Open items recorded there include: the overfitting
  figure's calibration claim is unverified, some interactive SVG elements are not
  keyboard-reachable, and some grey body text is low contrast. See AUDIT-NOTES.md for the
  full list and status.
