# Required repository array proof

Original October 12 Critical A1 requires the actual parser to reject missing or
null repository `workflows` and `pullRequests` arrays at their exact JSON paths.
The new cases independently omit or null each field while retaining a valid
repository, then assert the complete diagnostic. An explicit empty-array control
remains accepted. No production parser or contract shape changed.

Four independent production mutants softened only one field for only undefined
or null. Each passed TypeScript compilation and failed exactly one new theory
case, with the other 56 parser cases passing. Restored parser tests passed 57/57.
The workspace run passed 389 library and 20 dashboard tests. Library coverage
passed unchanged floors at 93.97% statements, 90.36% branches, 93.68% functions
and 94.59% lines. Typecheck, lint and both library/app builds passed.

All execution used an owned disposable Node24 guest without host mounts, ports,
socket, privilege or credentials. Locked dependencies were installed with lifecycle
scripts disabled; network access was disconnected before tests. A Windows Python
log-capture decoding failure and an initial dynamic-delete lint error were setup
iterations, not mutation evidence. The fixture now uses Reflect.deleteProperty
without changing its omission behavior. The guest is stopped with logs retained.
Full hosted CI remains required before merge.
