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
docker compose up -d
npx prisma migrate deploy
npm install
npm run dev
```

- Health: <http://localhost:3000/health> (no DB)
- Readiness: <http://localhost:3000/ready> (checks DB)

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Dev server with reload (`tsx watch`) |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run compiled app |
| `npm run lint` | Typecheck only (`tsc --noEmit`) |
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

- Minimal Fastify server with `/health` and `/ready`
- Prisma schema with `Organization` + initial migration
- `docker-compose.yml` for Postgres 16
- CI workflow: `npm ci`, `prisma generate`, typecheck, build

Next steps follow **Week 1–2** in `docs/MAINTENANCE_DEBT_RADAR.md`.
