# Maintenance Debt Radar

Backend bootstrap: **Node.js 20**, **TypeScript**, **Fastify**, **PostgreSQL**, **Prisma**, **Docker Compose**, **GitHub Actions** CI.

Full product specification: [`docs/MAINTENANCE_DEBT_RADAR.md`](docs/MAINTENANCE_DEBT_RADAR.md).

## Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for Postgres)

## Local setup

```powershell
cd maintenance-debt-radar
copy .env.example .env
# Edit .env: set DATABASE_URL (Compose default matches .env.example) and JWT_SECRET (min 32 chars in production).
docker compose up -d
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

- Health: <http://localhost:3000/health> (no DB)
- Readiness: <http://localhost:3000/ready> (checks DB)

### Auth (JWT)

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/auth/register` | Body: `{ "email", "password" (min 8), "organizationName"?, "displayName"? }` — creates org + admin user, returns JWT |
| `POST` | `/auth/login` | Body: `{ "email", "password" }` — returns JWT |
| `GET` | `/auth/me` | Header: `Authorization: Bearer <token>` |

After seed, you can log in as `demo@example.com` / `demo12345`.

```powershell
curl -s -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d "{\"email\":\"demo@example.com\",\"password\":\"demo12345\"}"
```

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Dev server with reload (`tsx watch`) |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run compiled app |
| `npm run lint` | Typecheck only (`tsc --noEmit`) |
| `npm run db:seed` | Seed demo org + user + sample service/repo |
| `npx prisma migrate dev` | Create/apply migrations in development |
| `npx prisma studio` | Browse DB in the browser |

## Create the GitHub repository (you must do this)

This environment cannot log into your GitHub account. Use **one** of the following.

### Option A — GitHub website

1. Open [github.com/new](https://github.com/new).
2. Repository name: e.g. `maintenance-debt-radar`.
3. **Do not** add a README, `.gitignore`, or license (this repo already has them).
4. Create the repository, then run (replace `YOUR_USER`):

```powershell
cd c:\Users\ATiwari14\cp_try\maintenance-debt-radar
git branch -M main
git remote add origin https://github.com/YOUR_USER/maintenance-debt-radar.git
git push -u origin main
```

### Option B — GitHub CLI (after install)

1. Install [GitHub CLI](https://cli.github.com/), then run `gh auth login`.
2. From this folder:

```powershell
cd c:\Users\ATiwari14\cp_try\maintenance-debt-radar
gh repo create maintenance-debt-radar --public --source=. --remote=origin --push
```

If the repo was created empty first:

```powershell
git remote add origin https://github.com/YOUR_USER/maintenance-debt-radar.git
git push -u origin main
```

## What is included so far

- Fastify server with `/health`, `/ready`, and **JWT auth** (`/auth/register`, `/auth/login`, `/auth/me`)
- Prisma schema for orgs, users, memberships, services, repo links, signals, action items (see `prisma/schema.prisma`)
- Migrations + **seed** (`demo@example.com` / `demo12345`)
- `docker-compose.yml` for Postgres 16
- CI workflow: `npm ci`, `prisma generate`, typecheck, build

Next steps follow **Week 1–2** in `docs/MAINTENANCE_DEBT_RADAR.md` (GitHub webhook ingestion, normalizer, triage API).
