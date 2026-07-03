# Learning with Sabih: project handoff

This file captures the current state of the project. It replaces the older continuation
prompt. Volatile facts below were read from the repo (app/topicList.js, package.json,
next.config.mjs, .github/workflows/) at the time of writing; if the repo and this file
disagree, trust the repo.

## What this project is

An interactive computer science study guide, built as a static Next.js export. Each topic
is one prose page plus one interactive figure that teaches the concept by letting the reader
step through it. The package name is `learn-with-sabih` and the repo is
`github.com/sabihusman/Learning-with-Sabih`.

## Current scope

Derived from app/topicList.js:

| Section | Topics |
| --- | --- |
| AI and ML | 13 |
| Algorithms and Data Structures | 10 |
| Databases and SQL | 11 |
| Object-Oriented Programming | 4 |
| Total | 38 across 4 sections |

The Databases and SQL section includes the three transaction topics (Atomicity,
Concurrency, Isolation levels); Isolation levels was the most recent addition.

## Status

The site is built and live in production at https://95.216.159.93/ (a raw IP that serves an
IP-scoped, non-public-CA certificate, so a browser or curl may warn about the cert). This is
a working, deployed site, not an early-stage prototype.

## Stack and architecture

Read from package.json and next.config.mjs:

- Framework: Next.js (^15.3.3), App Router, React 19.
- Static export: next.config.mjs sets `output: 'export'`, `trailingSlash: true`, and
  `images: { unoptimized: true }`. The build emits a static `./out` directory.
- Content: MDX via `@next/mdx` and `@mdx-js/*`. Each topic is an `app/topics/<slug>/page.mdx`
  file that imports and embeds its interaction component.
- 2D animation: anime.js (`animejs` ^4.0.0) and CSS, for visual flourish only.
- 3D topics: React Three Fiber (`@react-three/fiber` ^9.6.1) with `@react-three/drei` and
  `three`, used by the topics that render 3D scenes (for example the attention and
  embeddings visualizations).
- Tests: Playwright (`@playwright/test`), run with `npx playwright test`.
- Lint: ESLint with `eslint-config-next`. Node 20 is used in CI.

## Deploy

On every push to `main`, the GitHub Actions workflow `.github/workflows/deploy.yml`
("Deploy to Hetzner") builds the static export and rsyncs `./out` over SSH to a Hetzner box
at `/var/www/study-guide/`, then runs a verify step that expects HTTP 200.

Verified this session: the box serves `nginx/1.24.0`, NOT Caddy, even though some infra
documentation describes Caddy. Treat nginx as the real production server.

## Working conventions

- Single source of truth: app/topicList.js. It holds one delimited row per topic
  (`section|num|title|subtitle|slug`) and derives the contents page and every page's
  prev/next navigation. Inserting a topic mid-list means renumbering the rows after it.
- The shared Figure shell (app/components/Figure.jsx) is presentational chrome that every
  interaction plugs into. Do not modify it for a single topic; interaction components own
  their own state and pass the shell only display config.
- Teaching progression is timer-driven: setInterval plus setState, never chained off
  requestAnimationFrame (rAF freezes in a backgrounded tab). anime.js or CSS may be used for
  cosmetic transitions, but not to drive the step-by-step teaching sequence. Do not call
  setState synchronously in a useEffect body; keep only interval cleanup in effects.
- Branch protection on `main` requires four status checks, referenced by their bare job
  names: `build`, `lint`, `link-check` (from the CI workflow) and `test` (from the e2e
  workflow). SonarCloud also reports but is not required; a red SonarCloud with all four
  required checks green shows as UNSTABLE, which is still mergeable.
- Merges are squash merges with a linear history; the branch is deleted on merge.
- "Done" means live in production (the deploy concluded success and the page is serving),
  not merely that the pull request was merged.

## Known parked items

- The deploy verify step uses a `-k` stopgap (`curl -sS -L -k` against https), which follows
  redirects but skips TLS certificate validation. This exists because SITE_DOMAIN is a raw
  IP with an IP-scoped certificate that cannot pass strict validation on a CI runner. The
  real fix is a proper domain with a valid certificate, after which `-k` should be dropped.
- The nginx-vs-Caddy documentation mismatch is unreconciled. The production server is nginx,
  but some infra documentation describes Caddy, and the infra files (for example a Caddyfile,
  a deploy runbook, or a server bootstrap script) are not tracked in this repo.
- The audit backlog lives in AUDIT-NOTES.md at the repo root.

## The build loop

Each topic follows the same loop:

1. A build prompt describes the topic and its interaction.
2. Claude Code builds the topic on a branch (component, data module, page.mdx with a clearly
   marked placeholder paragraph, topicList row, and an e2e smoke entry).
3. Prose is drafted for the topic.
4. The prose is finalized against the figure with a match-the-build check: every factual
   claim in the prose is verified against what the figure actually computes, and the prose is
   corrected to match the figure, never the reverse.
5. The prose is applied, replacing the placeholder paragraph.
6. The pull request is merged (squash).
7. The change is confirmed live in production before it is called done.
