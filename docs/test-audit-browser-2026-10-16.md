# Required browser qualification and host role downgrade

The deferred October 12 consumer-test hygiene item placed assertions inside
Playwright route callbacks. Request payloads are now recorded there and asserted
after the awaited response completes, alongside exact response status/body checks.
An actual test-host payload mutation fails all three merge cases at their direct
payload assertions, without a test timeout. Original request-count semantics remain.

Running the previously ungated browser suite also exposed an actual role bug:
`(adminSignal && hasUrl) || hasFetcher` ignored a false host signal whenever a
privileged fetcher remained configured. The host role-switch browser case failed
with private data and merge controls still visible. A focused unit case separately
failed while the other ten passed. The corrected expression requires the host
signal for either privileged source. No API signature changes; the package
changelog records the corrected behavior.

After the fix, all ten real Chromium cases pass with retries explicitly disabled,
including private-data removal, guest/admin switching, merge errors and receipts,
outage recovery, keyboard/phone layout and standalone dashboard checks. A required
ten-minute browser job runs the existing e2e command with `--retries=0`; existing
jobs and caps remain. Removing its CI Gate dependency makes the unchanged workflow
checker reject the workflow; the actual wiring passes.

The full workspace passed 390 library and 20 dashboard tests. Coverage remains
93.97% statements, 90.36% branches, 93.68% functions and 94.59% lines with unchanged
floors. Typecheck, format and lint passed (35 existing warnings, zero errors).
The actual e2e pipeline rebuilds the library and consumer host before Chromium;
its restored run passed all ten cases in 5.2 seconds.

Execution used an owned disposable Playwright 1.63.0 guest without host mounts,
socket, credentials, ports or privilege. Public locked install disabled lifecycle
scripts; network disconnected before execution. Only guest-local build/test output
was cleaned by the existing tools. The guest is stopped and evidence retained.
Full hosted CI, including the new required browser lane, remains required before merge.
