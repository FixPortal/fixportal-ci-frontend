# Temporary Stryker 10 / Vitest 5 compatibility guard

The explicit `test:mutation` entrypoint validates the exact installed local tuple
and full hashes of both runner name collectors before patching either. Unknown
versions, unknown files, mixed states, shadow Vitest resolution and escaping paths
fail closed. There is no installation hook or package acquisition.

Vitest 5 joins nested test names with `>`, while Stryker10.0.0 uses spaces. This
can skip the intended nested assertions during mutation runs. See the
[Vitest migration guide](https://vitest.dev/guide/migration/#testnamepattern-matches-the-joined-full-name),
[upstream issue6210](https://github.com/stryker-mutator/stryker-js/issues/6210) and
[upstream fix6214](https://github.com/stryker-mutator/stryker-js/pull/6214).

A real tiny JavaScript canary runs in required CI and before mutation measurement.
It requires its known false-condition mutant to be killed by the nested literal
assertion, with an active-ID/hit/failure witness. Tool exit or score alone is
insufficient. JavaScript avoids adding a TypeScript checker this project does not
use. Only Linux process-group execution is qualified by this entrypoint; Windows
mutation execution is unsupported and fails rather than skipping.

Current corrected production score is unmeasured. Historical raw reports remain
historical, and are runner-limited only where their actual tuple supports that
attribution. Targeted canary proofs do not establish a whole-project score.
Production mutation scope, observational break:null, and the existing job budget
are unchanged. A full corrected measurement needs a separate run and review.

Remove the shim after an official released runner passes the same real canary
without patching, then qualify the production scope. Version changes require an
explicit review, not silent fallback. Required canary reports are retained under
the package's generated reports/mutation-canary directory.
