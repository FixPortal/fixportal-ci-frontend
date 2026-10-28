# Reading the CI board

This guide is for people who look at the deployed CI board and want to know what it shows. You do not configure anything to use it. To set a board up, read the [setup guide](setup-guide.md).

## What the board is

The board shows an organisation's repositories on one page: workflow runs, deploys, packages and open pull requests. It is display-only, apart from one optional action: merging a pull request.

The header shows `[Guest]` or `[Admin]`. A guest sees public repositories only. The admin view also shows private repositories and the merge controls.

The board asks for fresh data every 30 seconds, even in a background tab. The toolbar shows "updated" and the snapshot age, such as "updated 2m ago". You do not need to reload.

## The summary at the top

- **Review** shows the open pull request count, the next pull request in the queue, and the last merged one. In the admin view, selecting the count steps through open pull requests, oldest first.
- **CI status** shows counts such as Running, Failing and No CI. A "CI health · 24h" bar has one bar per hour. Red means the hour counts as failing: a run failed that hour, or an earlier failure is still carried forward. Select a red hour to list the failed runs the board holds for it. Green means passing and grey means no data. The oldest hour is on the left. When a host limits the board to a single repository, the bar is hidden, because the trend covers the whole organisation.
- **Inventory** shows plain totals such as repositories and workflows.

A dash instead of a number means there is no data. It is not a zero. The Legend button explains the dots.

## What a repository card shows

Select a repository name to collapse or expand its card. The card header can show:

- A "No CI" tag if the repository has no workflows.
- Code size figures: NLOC, avg CCN, functions, and "complex" (functions over CCN 15), when data exists.
- The open pull request count, then two dots labelled CI (workflows) and CD (deploys and packages).
- A link to the repository on GitHub.

The body lists workflows, then Deploys and Packages rows if any exist, then open pull requests. Selecting a chip opens its latest run on GitHub in a new tab.

## Status colours and labels

Workflow, deploy and package chips have one of four states. Each also differs by dot shape, so colour is not the only cue.

| State   | Label          | Look                                    |
| ------- | -------------- | --------------------------------------- |
| success | passing        | Green dot                               |
| failure | failing        | Red square dot                          |
| running | running        | Pulsing dot                             |
| unknown | status unknown | Hollow dot, dashed outline, muted label |

A workflow chip also shows the age of its last run. For an unknown state it says "no status" or, with no runs, "no runs".

The CI and CD dots on a card show the worst state in their group: failing, then running, then passing. A hollow dot means none of those.

## Pull requests and review pills

Each pull request line shows number, title, author, age, and "draft" if it is a draft. Review pills show one reviewer or scanner each:

| State       | Meaning                                  | Look                       |
| ----------- | ---------------------------------------- | -------------------------- |
| clean       | Ran and left nothing open                | Green dot                  |
| outstanding | Has open items. A number shows how many. | Red square dot             |
| pending     | Not yet reviewed                         | Hollow dot, dashed outline |
| disabled    | Not required                             | Dashed outline, no dot     |

Clean and outstanding pills link to the reviewer. An unrecognised state shows as a dashed pill labelled "status unknown".

GitHub CodeQL, Code Quality and Secret Scanning are enabled on public repositories only. Their pills do not appear on private ones and never hold back "Ready to merge".

If a pull request has no pills, the board has no review data for it. UNVERIFIED: the board does not say why. This is refuted if a snapshot carries an explanation that the board displays.

## Ready to merge

A green "Ready to merge" pill appears only when the backend has judged the pull request ready. The board does not work this out itself. A missing pill means not ready or not yet assessed, and the board does not distinguish the two. The toolbar's "Ready to merge" button shows only repositories with at least one ready pull request.

## The merge action

In the admin view the pill becomes a button titled "Rebase-merge this PR". It reads "Merging…" while it works, then "✓ Merged". With two or more ready pull requests that each have a recorded head commit, "Merge all (oldest first)" appears. It stops at the first failure.

The button is absent for guests and for a pull request with no recorded head commit. It is disabled while that merge runs.

A failed merge shows a message on the card, such as "Not authorised to merge" or "Network error". Use "✕" to dismiss it. The board refreshes after each attempt.

In the admin view the button always appears for a ready pull request with a recorded head commit. Whether the merge succeeds depends on how the operator wired the merge call; if it is not set up, the card shows "Not authorised to merge". See the [setup guide](setup-guide.md), "Letting admins merge from the board".

## Filters and display options

- **Search** ("Filter repos or PRs...") matches repository names, pull request titles, and numbers with or without "#".
- **CI Status**: Running, Failing, Passing, No-CI. Within a group the chips combine with "or". Groups combine with "and". A repository is placed by its worst state.
- **Visibility**: Public, Private. Admin view only.
- **Has PRs**: only repositories with open pull requests.
- **Hide No-CI**: becomes "Show No-CI · N hidden" when on. It appears only when at least one repository has no CI.
- **⊟ Collapse all** / **⊞ Expand all**: collapses or expands every repository card at once. The label shows what a press will do.
- **Theme** in the header: System, Light or Dark, remembered in your browser. The operator can hide it.

The board remembers your search text, your filters, Hide No-CI and which cards you collapsed in your browser's local storage, so they are still there next time. This is best effort: a private window or blocked storage forgets them. A host that embeds the board can give it its own storage namespace, so two boards on one site do not share these settings.

A line under the toolbar reads "N of M repositories" when filters apply. If nothing matches, you see "No repositories match the active filters." and "Clear filters". If Hide No-CI is the only reason the board is empty, you see "All repositories are No-CI — hidden." instead, with no "Clear filters" button; turn off Hide No-CI to see them. The board has no control for repository order.

## Waiting, stale and error states

- "Loading dashboard…": first load.
- "Waiting for the first refresh…": the backend is up but has no snapshot yet (HTTP 204). The board keeps checking.
- "Dashboard unavailable. Retrying automatically.", with "Retry now": the first load failed.
- "refresh failed · retrying", beside the "updated" time: a later refresh failed. The last good data stays on screen, so check its age.
- "No repositories found.": nothing visible to you.
- "All repositories are No-CI — hidden.": Hide No-CI is on and every repository has no CI. Use "Show No-CI · N hidden".

## If something looks wrong

1. Check the "updated" time. If it is old, or "refresh failed · retrying" shows, tell whoever operates the deployment that the data feed is down.
2. If "Waiting for the first refresh…" lasts long, tell the operator.
3. If a repository is missing, clear filters and turn off Hide No-CI. Guests never see private repositories. Then ask the operator.
4. If an expected "Ready to merge" pill is missing, ask the operator. It depends on the backend.
5. If a merge says "Not authorised to merge", ask the operator to check your access.
6. For anything else, give the operator the exact message and the "updated" time.

The operator is whoever deployed the board.
