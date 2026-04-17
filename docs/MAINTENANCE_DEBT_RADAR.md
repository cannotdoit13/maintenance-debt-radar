# Maintenance Debt Radar — Project Specification

An internal engineering tool that ingests **reliability signals** (starting with **GitHub Actions / check runs**), normalizes them into a **timeline per service**, and surfaces a **prioritized backlog** of maintenance work with owners, due dates, and audit history.

**Audience:** You, building a portfolio project with backend + frontend + PostgreSQL + CI/CD.  
**Prior knowledge assumed:** JavaScript only; system design and infra can be learned alongside this doc.

---

## 1. Problem statement

Teams know their services are flaky, but “flaky” is scattered across:

- CI failures and cancelled workflows  
- Pull request checks  
- (Later) incidents, on-call notes, or manual tags  

This project **does not** try to replace Datadog/Sentry/Jira. It tries to be a **focused radar**: connect **one strong signal source first**, show a **credible timeline**, and turn signals into **actionable, owned work items**.

---

## 2. MVP promise (Phase A)

> Connect GitHub CI signals into a **single timeline per repo/service**, then generate a **prioritized backlog** of reliability work with **owners, due dates, and audit history**.

### In scope (Phase A)

- GitHub webhook ingestion (verified, idempotent)  
- Raw payload storage + normalized `signal_event` rows  
- Map `owner/repo` → logical **service**  
- Service dashboard (ranked) + service detail timeline  
- Rule-based **score** over a time window (documented formula)  
- **Action items** (create, assign, status, comments)  
- Auth + basic RBAC (org admin / member / viewer)  
- Docker Compose for local dev  
- CI on PRs + deploy to **staging**  

### Out of scope (Phase A)

- SSO for every identity provider  
- Perfect SLO/error-budget math  
- Many third-party integrations  
- Mobile apps  

### Phase B (later)

- Second signal: manual **CSV incident import** or a generic internal webhook  
- Suppressions / “known flake” with expiry  
- Email or Slack notifications (optional)  
- Trend snapshots / weekly digest  

### Phase C (optional, much later)

- OIDC SSO, hard multi-tenant isolation, advanced analytics  

---

## 3. High-level architecture

Think in **layers**. Core pattern: **append-only ingestion** + **derived state** (scores, action items).

```
GitHub ──webhook──► Ingestion API ──► integration_delivery (raw)
                         │
                         ▼ (async job)
                  Normalizer ──► signal_event (canonical facts)
                         │
                         ▼
                  Scoring job ──► service.score (derived)
                         │
                         ▼
              Application API ◄──► Frontend (dashboard, timeline, triage)
                         │
                    PostgreSQL
```

### 3.1 Ingestion

- **Endpoint:** `POST /integrations/github/webhook`  
- **Verify** GitHub `X-Hub-Signature-256` using a shared secret.  
- **Idempotency:** store `X-GitHub-Delivery` (or equivalent) as a **unique** key so retries do not duplicate work.  
- **Fast path:** validate → persist raw payload → return `2xx` quickly. Heavy work runs **asynchronously**.

### 3.2 Storage (one PostgreSQL database, logical parts)

| Logical area | Purpose |
|--------------|--------|
| **Raw inbox** | Debug and replay; optional but very useful for demos and interviews. |
| **Canonical events** | Immutable facts: what failed, when, for which repo/workflow. |
| **Operational objects** | Services, mappings, users, action items, comments, audit log. |

### 3.3 Suggested tables (MVP)

- `organization`, `user`, `membership`  
- `team` (optional early)  
- `service` — logical product/system  
- `repo_link` — maps `repo_full_name` → `service_id`  
- `integration_delivery` — raw webhook + headers metadata, **unique** `delivery_id`  
- `signal_event` — normalized row: `org_id`, `source`, `event_type`, `occurred_at`, `repo_full_name`, conclusions, **unique** `dedupe_key`  
- `action_item` — title, severity, owner, due_at, status, `service_id`, optional link to originating event  
- `comment` (optional)  
- `audit_log` — who changed mapping or item  

### 3.4 Normalizer (“adapter”)

- Worker reads new `integration_delivery` rows.  
- Maps GitHub payload shapes → `signal_event` types (start with **one** family, e.g. `workflow_run`).  
- **`dedupe_key`** examples: `github:workflow_run:<id>`, `github:check_run:<id>`  
- On duplicate: rely on DB unique constraint → ignore / mark processed.

### 3.5 Scoring (Phase A — keep it honest)

- **Time window:** e.g. last 14 days.  
- **Rule-based:** count failures with weights; optional boost for repeated same workflow.  
- Store `service.score`, `service.score_updated_at` **or** a small `service_score_snapshot` table.  
- **Document the formula** in README (“v0 heuristic, not a scientific SLO”).

### 3.6 Application API

Representative routes:

- `GET /services` — list, sorted by score  
- `GET /services/:id/timeline` — paginated `signal_event`  
- `POST /repo-links`, `GET /repos/unmapped` — onboarding  
- `POST /action-items`, `PATCH /action-items/:id`  
- Settings: webhook URL instructions, secret rotation notes  

### 3.7 Frontend

- **Dashboard** — ranked services + key numbers  
- **Service detail** — timeline + linked repos + open action items  
- **Triage** — action item queue  
- **Settings** — mappings, members (minimal)  

### 3.8 Async jobs

Pick one approach and stay consistent:

- **pg-boss** (Postgres-backed queues, fewer moving parts), or  
- **BullMQ + Redis**, or  
- In-process queue **only** for the first local spike (replace before staging).

### 3.9 CI/CD

- **GitHub Actions:** install → lint → typecheck → test → build (and Docker build if you use images).  
- **Environments:** local (Compose), **staging**, later production.  
- **Migrations** on deploy via one explicit step.

### 3.10 Observability (lightweight)

- Structured logs + **correlation/request id**  
- Log `delivery_id` on webhook receipt  
- `GET /health`, `GET /ready` (DB check)

---

## 4. Security notes (short)

- Never log full webhook secrets or PATs.  
- Rate-limit the public webhook route; cap body size.  
- RBAC: viewers cannot change mappings or close items.  
- Document “this is a demo/staging; use org-scoped tokens with minimum scope.”

---

## 5. Phased execution

### Phase A — Portfolio MVP

Exit criteria:

1. GitHub → verified, idempotent ingestion  
2. Repo → service mapping + **unmapped repo inbox**  
3. Timeline + dashboard ranking  
4. Action items + audit trail  
5. Staging deploy + green CI on PRs  
6. README: architecture diagram + limitations + formula  

### Phase B — Credible internal platform

- Second signal source or CSV import  
- Suppressions with expiry  
- Notifications (optional)  
- Better trends  

---

## 6. Weekly schedule (~12 hours/week, Phase A)

Roughly **10 weeks (~120 hours)** for a strong MVP. Treat weeks as **units** if you slip or sprint.

| Week | Focus | Hours (guide) | Deliverable |
|------|--------|---------------|-------------|
| **1** | Spec, repo layout, Docker Postgres, migrations, core tables | 12 | App boots, DB migrates |
| **2** | Auth + RBAC + seed user/org | 12 | Protected routes work |
| **3** | GitHub webhook: verify, store raw, fixtures, tests | 12 | Real deliveries stored |
| **4** | Worker: raw → `signal_event`, dedupe, errors visible | 12 | Normalized timeline data |
| **5** | Timeline API + service detail UI | 12 | Clickable timeline |
| **6** | Repo mapping CRUD + unmapped inbox + audit | 12 | Onboarding without SQL |
| **7** | Scoring job + dashboard + “why this score” copy | 12 | Signature dashboard |
| **8** | Action items + triage UI + optional comments | 12 | End-to-end triage story |
| **9** | GitHub Actions CI + staging deploy + hardening | 12 | PR checks + public staging |
| **10** | Demo data script, diagrams, README, 2-min demo script | 12 | Presentable portfolio piece |

---

## 7. Biggest pitfalls (avoid these)

1. Subscribing to **too many** GitHub event types at once — master **one** first (`workflow_run` *or* `check_suite`).  
2. Doing scoring or heavy parsing **inside** the webhook handler — keep it thin.  
3. Skipping **idempotency** — retries will corrupt your timeline.  
4. No **unmapped repo inbox** — demos stall on configuration.  

---

## 8. Stack suggestions (JavaScript-first)

You can stay entirely in **TypeScript**:

| Layer | Suggested options |
|-------|-------------------|
| Backend | **Node + Fastify** or **NestJS** |
| DB | **PostgreSQL** |
| ORM / migrations | **Prisma** or **Drizzle** |
| Frontend | **React + Vite** or **Next.js** |
| Jobs | **pg-boss** or **BullMQ** |
| Auth | **session** or **JWT** (document tradeoffs); add magic link later if desired |
| Hosting | **Fly.io**, **Railway**, **Render**, or small **AWS** setup |

Pick **one** job queue and **one** ORM early; changing later is costly.

---

## 9. Learning path — topics to read & practice (beginner → this project)

You said you know **JavaScript only** and **no system design**. Below is an ordered path: each block has **what to learn** and **why it matters for this project**.

### 9.1 TypeScript (1–2 weeks of practice alongside)

- Types, interfaces, generics at a **basic** level  
- `strict` mode, narrowing, `unknown` vs `any`  
- **Why:** industry TS backends and safer refactors.

**Resources:** Official TypeScript handbook (handbook only, no need to read everything).

### 9.2 HTTP and APIs (3–5 days)

- REST basics: resources, **idempotency**, status codes, pagination query params  
- JSON request/response, headers  
- **Why:** your entire ingestion + app API is HTTP.

**Practice:** build a tiny CRUD API with 3 routes and test with `curl` or Thunder Client.

### 9.3 Relational databases and SQL (ongoing, ~2–4 weeks core)

- Tables, primary keys, **foreign keys**, indexes (conceptual)  
- **Transactions** (ACID) at a high level  
- **Why:** `signal_event` + `repo_link` + `action_item` need correct constraints.

**Practice:** draw schema on paper, write `SELECT` with `JOIN`, add a unique constraint and see duplicate inserts fail.

### 9.4 PostgreSQL + migrations (1 week)

- Why migrations exist (versioned schema)  
- Local Postgres via Docker  
- **Why:** every serious backend uses repeatable schema changes.

**Practice:** create tables for `service` and `signal_event` only, migrate up/down.

### 9.5 Authentication & authorization (1–2 weeks)

- Hashing passwords (**bcrypt** / **argon2**), never store plaintext  
- Sessions vs JWT (pros/cons); CSRF if cookies  
- **RBAC:** roles on `membership`  
- **Why:** multi-user org tool; interviewers will ask.

**Practice:** protect one route; add `viewer` who gets 403 on `POST`.

### 9.6 Webhooks & security (3–7 days)

- HMAC signature verification (GitHub’s `X-Hub-Signature-256`)  
- Replay/idempotency via **delivery id**  
- **Why:** this is the heart of ingestion.

**Read:** GitHub docs: “Webhooks” + “Securing your webhooks”.

### 9.7 Background jobs & async processing (1 week)

- Why webhooks should ACK fast  
- At-least-once delivery → **idempotent** consumers  
- **Why:** your normalizer is a small event consumer.

**Practice:** enqueue “process delivery X” after insert; worker updates row status.

### 9.8 System design — **small** pieces (throughout, not one giant course)

Learn these **terms** in context of *your* app:

| Topic | Applied here |
|-------|----------------|
| **Separation of concerns** | Ingestion vs normalization vs UI |
| **Idempotency** | Same webhook twice → same outcome |
| **Durability** | Postgres as source of truth |
| **Pagination** | Timeline API |
| **Rate limiting** | Public webhook endpoint |
| **Observability** | Logs + correlation id |

**Resources (pick one style):**

- **ByteByteGo** (newsletter/book): big-picture diagrams; read chapters on **load balancers, databases, message queues** when you add jobs.  
- **“Designing Data-Intensive Applications” (Martin Kleppmann):** excellent but dense — read **Chapter 1** early; treat the rest as reference.  
- **Hussein Nasser** (YouTube): deep dives on HTTP, TCP, proxies — watch topics as you hit them.

Do **not** try to finish all of DDIA before coding. Alternate **read 1 concept → implement 1 slice**.

### 9.9 Docker & Compose (3–5 days)

- `Dockerfile` basics, `docker compose up` for app + Postgres  
- **Why:** reproducible dev and credible deploy story.

### 9.10 CI/CD (3–5 days)

- GitHub Actions: workflow on `pull_request`  
- Cache dependencies, run tests, fail fast  
- **Why:** resume line + real engineering habit.

**Practice:** CI fails if lint fails; main branch deploys staging (manual approval is OK at first).

### 9.11 React (if frontend is new) (2–6 weeks parallel)

- Components, state, `fetch` or TanStack Query  
- Forms and validation  
- **Why:** dashboard + timeline UI.

### 9.12 Testing (ongoing)

- **Unit tests** for signature verification and dedupe logic  
- **Integration tests** against a test DB (optional in week 1; add by week 4)  
- **Why:** ingestion bugs are subtle; tests save you in interviews.

---

## 10. First coding milestones (order matters)

1. **Docker Postgres + one table** migrated from code.  
2. **Health + DB check** route.  
3. **Register/login** + one protected `GET /me`.  
4. **Webhook route** that verifies signature and stores raw JSON + `delivery_id`.  
5. **Worker** that creates `signal_event` for one GitHub event type.  
6. **List services** + **timeline** for one manually linked repo.  
7. Everything else from the week table.

---

## 11. Optional: companion project (#3) later

**Shelter ↔ surplus food matcher** — constraint-heavy scheduling; good second project after you have Postgres, auth, and CI/CD muscle from this one.

---

## 12. Document history

| Version | Notes |
|---------|--------|
| 1.0 | Initial spec from planning conversation; JavaScript-first learning path added |

---

*This file is the single source of truth for scope and architecture until you revise it.*
