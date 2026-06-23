# AI Findings Ledger

Un-dismissable static-analysis findings (GitHub Code Quality, CodeQL, Copilot AI Findings).
Substitute for the missing dismiss UI — match by `file:line` + rule before re-investigating.

| Finding | Status | Reason | Rationale | First seen |
|---|---|---|---|---|
| `apps/dashboard/src/App.tsx:12` react-doctor url-prefilled-privileged-action | dismissed | false-positive | `?admin` is presentation-only; real authz enforced server-side (documented in code comment + CLAUDE.md) | 2026-06-23 |
