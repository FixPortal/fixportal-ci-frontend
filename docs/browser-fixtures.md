# Browser consumer checks

Run `npm run test:e2e` after `npm ci --ignore-scripts` and installing the
Playwright Chromium browser (`npx playwright install chromium`). The command
typechecks the fixtures and owns strict loopback ports 5364 and 5365. It fails
if either port is occupied, rather than testing an unrelated development server.

The standalone guest dashboard runs on 5364. The separately built test consumer
in `e2e/host` runs on 5365 and exercises the published `CiBoard` host callbacks.
It is outside both shipped workspace builds. Its data and merge responses are
synthetic and intercepted by Playwright; no credential or live GitHub mutation
is required. The standalone app remains guest-only.

The consumer checks private-data removal after a role change, permission and
stale-head merge failures, the successful merge receipt and refresh, initial
outage recovery, cached-data retention during an outage, and keyboard search
at a phone viewport. Loading checks use a response-release signal rather than
assuming a fixed delay is enough to observe loading.

The interaction attachment records browser Event Timing durations reported
above the browser's 16ms floor. An empty sample is not INP zero. This is a local
synthetic interaction sample, not a field percentile or evidence of production
authentication and GitHub rebase-merge integration. Those require host evidence.

## Remaining development dependency advisory

The lockfile resolves `qs` 6.16.0 and `fast-uri` 3.1.8. The remaining audit chain
is `archunit` 2.5.4 → `plantuml-parser` 0.4.0 → `fast-glob` 3.3.3 → `micromatch`
4.0.8 → `braces` 3.0.3 (GHSA-vfj7-8cjw-p6xm). On 2026-10-03, npm reports no
patched version. The production dependency audit reports zero vulnerabilities.

Our architecture wrapper imports `archunit/dist/src/files`; importing that
entry in Node does not load `plantuml-parser`, `fast-glob`, `micromatch` or
`braces`. Its file assertions use ArchUnit's separate minimatch path. The
affected PlantUML parser's `parseFile` path calls fast-glob, but our tests do
not use the PlantUML API. This bounds the observed exposure without removing
architecture coverage or suppressing npm's advisory. Reassess when adopting
PlantUML APIs, changing the ArchUnit entry, or when an upstream patch appears.
The development resolved-graph finding remains tracked pending that patch.
