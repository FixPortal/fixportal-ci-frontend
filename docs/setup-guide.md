# The idiot's guide to setting up the CI dashboard

No prior knowledge assumed. Pick the section that matches what you want; they are
ordered by effort, and each one stands alone.

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

```bash
docker run -p 8080:8080 \
  -e BACKEND_URL=https://fixportal-ci-backend.happycoast-d46c800d.uksouth.azurecontainerapps.io \
  ghcr.io/fixportal/fixportal-ci-frontend:latest
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
   - **Metadata**: Read-only (GitHub ticks this for you)
5. Generate it and copy the token. It is shown **once**.

### Step 2 — start both pieces

```bash
git clone https://github.com/FixPortal/fixportal-ci-backend.git
cd fixportal-ci-backend
cp .env.example .env
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

```bash
docker compose up
```

Open <http://localhost:8082>.

The first snapshot takes a short while to appear — the backend has to walk every
repository. Until then the board says it is waiting for a snapshot. That is
normal, not an error.

> **Leave `Admin__ExposePrivateToGuests` alone.** It is commented out in
> `.env.example` for a reason: it makes the *unauthenticated* endpoint hand out
> your private repositories to anyone who can reach the port.

### If something goes wrong

| What you see | What it means | Fix |
|---|---|---|
| Backend container exits with `GitHub:Owner must be configured` | It cannot find your `.env` | Make sure `.env` sits in the same folder as `docker-compose.yml`, and both lines are filled in |
| Board says "waiting for snapshot" forever | The backend has not finished its first pass, or the token lacks **Actions: Read** | Check `docker compose logs backend` |
| Board loads but your private repos are missing | Working as designed — the anonymous endpoint serves public repos only | Nothing to fix |

---

## 3. "I want the board inside my own React app"

Install the package. No token, no registry setup — it is on public npm and has
**zero runtime dependencies**.

```bash
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

Two things people trip over, both covered in the
[main README](../README.md#styling):

- If you already have your own design system, import **only** `board.css` and the
  board adopts your colours automatically.
- If you write tests that render this component under jsdom, you need two small
  stubs. jsdom does not implement `ResizeObserver` or `window.matchMedia`.

---

## 4. "I want to change the code"

You need **Node 22 or newer** and nothing else — no tokens, no private packages.

```bash
git clone https://github.com/FixPortal/fixportal-ci-frontend.git
cd fixportal-ci-frontend
npm install
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

Before opening a pull request, run the same four checks CI runs:

```bash
npm test          # unit tests
npm run lint      # ESLint
npm run build:lib # build the component library
npm run build:app # type-check and build the app
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
  reveals private repositories and action links. Derive it from your own app's
  login state — it is a display switch, not a security control. The backend
  decides what it is willing to serve.
