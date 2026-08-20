# The Neophyte's guide to setting up the CI dashboard

No prior knowledge assumed. Pick the section that matches what you want; they are
ordered by effort, and each one stands alone.

The commands below are written for PowerShell in Windows Terminal. Run each
command on its own line.

**What this thing is.** A wall-mountable dashboard showing, for every repository
in a GitHub organisation, whether the build is green, what pull requests are
open, and how things have trended over the last 24 hours. Two pieces: a
**backend** that talks to GitHub and writes a snapshot, and this **frontend**
that draws it. The frontend never talks to GitHub — it only ever reads one JSON
file from the backend.

---

## 1. "Just show me what it looks like" (about a minute)

You need [Docker Desktop](https://www.docker.com/products/docker-desktop/) and
nothing else. Paste this in a terminal:

```powershell
docker run -p 8080:8080 -e BACKEND_URL=https://ci.fixportal.org ghcr.io/fixportal/fixportal-ci-frontend:latest
```

Open <http://localhost:8080>.

You are looking at the real, live CI status of the FixPortal open-source
repositories, served from a public read-only backend. Nothing was configured and
no account was created.

Press `Ctrl+C` in the terminal to stop it.

> **What just happened:** you ran a small web server that serves the dashboard
> and forwards any request starting with `/api/` to the address in
> `BACKEND_URL`.

---

## 2. "I want it pointed at my own GitHub" (about ten minutes)

This is what most people want. The GitHub connection lives in the **backend**, so
this section is mostly about that repo — it starts both pieces for you.

### Step 1 — get a GitHub token

A token is a password that only permits the specific things you tick.

1. Go to <https://github.com/settings/personal-access-tokens/new> (Settings →
   Developer settings → Personal access tokens → Fine-grained tokens).
2. **Resource owner**: pick the organisation (or your own account) you want on
   the board.
3. **Repository access**: All repositories.
4. Under **Permissions → Repository permissions**, set:
   - **Actions**: Read-only — *required*, this is the build status
   - **Pull requests**: Read-only — for open-PR counts
   - **Contents**: Read-only — for the code metrics
   - **Code scanning alerts**: Read-only — only if you configure a CodeQL review pill
   - **Metadata**: Read-only (GitHub ticks this for you)
5. Generate it and copy the token. It is shown **once**.

### Step 2 — start both pieces

```powershell
git clone https://github.com/FixPortal/fixportal-ci-backend.git
```

```powershell
Set-Location fixportal-ci-backend
```

```powershell
Copy-Item .env.example .env
```

Open `.env` in any text editor and fill in two lines:

```dotenv
GITHUB_TOKEN=github_pat_...your token...
GITHUB_OWNER=your-org-or-username
```

> **That file now holds a live credential.** Never commit it, and never paste it
> into an issue, a screenshot or a chat message. The backend repo already ignores
> `.env` in its `.gitignore`, so plain `git add .` will not pick it up — but if
> you copy the file elsewhere, that protection does not travel with it.
>
> If the token is ever exposed, revoke it immediately at
> <https://github.com/settings/personal-access-tokens> and generate a new one.
> Revoking is instant and costs nothing; a leaked read token exposes every
> repository it can see.

Then:

```powershell
docker compose up
```

Open <http://localhost:8082>.

The first snapshot takes a short while to appear — the backend has to walk every
repository. Until then the board says it is waiting for a snapshot. That is
normal, not an error.

> **Leave `Admin__ExposePrivateToGuests` alone.** It is commented out in
> `.env.example` for a reason: it makes the *unauthenticated* endpoint hand out
> your private repositories to anyone who can reach the port.

Review pills and the Ready-to-merge verdict are optional backend enrichment.
The backend ships with `ReviewSignals:Reviewers` empty, so neither appears until
you configure reviewers in deployment settings. Follow the backend's
[Review signals guide](https://github.com/FixPortal/fixportal-ci-backend#review-signals-reviewsignals);
a CodeQL reviewer also needs the **Code scanning alerts: Read-only** token
permission listed above. The rest of the dashboard works without this setup.

### If something goes wrong

| What you see | What it means | Fix |
|---|---|---|
| Backend container exits with `GitHub:Owner must be configured` | It cannot find your `.env` | Make sure `.env` sits in the same folder as `docker-compose.yml`, and both lines are filled in |
| Board says "waiting for snapshot" forever | The backend has not finished its first pass, or the token lacks **Actions: Read** | Check `docker compose logs backend` |
| Board loads but your private repos are missing | Working as designed — the anonymous endpoint serves public repos only | Nothing to fix |

---

## 3. "I want the board inside my own React app"

Install the package. No token or registry setup is needed: it is on public npm,
has no bundled runtime dependencies, and uses the three peer dependencies your
app supplies.

```powershell
npm install @fix-portal/ci-frontend @tanstack/react-query react react-dom
```

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CiBoard } from '@fix-portal/ci-frontend'
import '@fix-portal/ci-frontend/tokens.css'
import '@fix-portal/ci-frontend/board.css'

const queryClient = new QueryClient()

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CiBoard adminSignal={false} apiBase="https://your-backend.example.com" />
    </QueryClientProvider>
  )
}
```

Three things people trip over, all covered in the
[main README](../README.md#styling):

- If you already have your own design system, import **only** `board.css` and the
  board adopts your colours automatically.
- The built-in Light / Dark / System selector changes only the board's `.ci-page`
  container. It does not change the host document's theme.
- If you write tests that render this component under jsdom, you need two small
  stubs. jsdom does not implement `ResizeObserver` or `window.matchMedia`.

---

## 4. "I want to change the code"

You need **Node 22 or newer** and nothing else — no tokens, no private packages.

```powershell
git clone https://github.com/FixPortal/fixportal-ci-frontend.git
```

```powershell
Set-Location fixportal-ci-frontend
```

```powershell
npm install
```

```powershell
npm run dev
```

That serves the app on <http://localhost:5173> and rebuilds as you edit.

To point it at a backend, copy `apps/dashboard/.env.example` to
`apps/dashboard/.env` and set `VITE_CI_API_BASE` to your backend's address.

> **The one non-obvious bit.** In dev mode the browser calls the backend from a
> different address than the backend is served on, and browsers block that unless
> the backend explicitly permits it. Start your backend with
> `Cors__AllowedOrigins__0=http://localhost:5173`. If you skip this the board
> just says "Dashboard unavailable" while the network tab shows perfectly good
> `200` responses. This does not affect the Docker setup, where both are served
> from one address.

Before opening a pull request, run the same checks CI runs:

```powershell
npm test
```

```powershell
npm run typecheck -w @fix-portal/ci-frontend
```

```powershell
npm run coverage -w @fix-portal/ci-frontend
```

```powershell
npm run lint
```

```powershell
npm run build:lib
```

```powershell
npm run build:app
```

---

## Which piece do I actually need?

| I want to... | Repo | Section |
|---|---|---|
| Look at a working example | neither, just Docker | 1 |
| Watch my own org's CI | `fixportal-ci-backend` | 2 |
| Put the board in my app | `@fix-portal/ci-frontend` on npm | 3 |
| Improve the board itself | this repo | 4 |

## Words used here

- **Backend** — the service that logs into GitHub and produces the snapshot.
- **Frontend** — this repo; draws the snapshot. Never sees your token.
- **Snapshot** — one JSON document describing every repo's current state. The
  board fetches it from `/api/dashboard/snapshot` and re-fetches periodically.
- **`BACKEND_URL`** — where the frontend's server forwards `/api/` calls. Must
  have no trailing slash.
- **`adminSignal`** — a prop. `false` gives the public read-only view; `true`
  enables private repositories and admin-only controls only when
  `adminSnapshotUrl` or `adminSnapshotFetcher` is also configured. Safe links
  supplied by the guest snapshot remain clickable. Derive the signal from your
  own app's login state — it is a display switch, not a security control. The
  backend decides what it is willing to serve.
