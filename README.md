# Inbox Assistant

Inbox-first task and project assistant. Railway backend + Vercel frontend.

## Setup

### Backend (Railway / local)

```bash
cd backend
cp .env.example .env
# Set DATABASE_URL (PostgreSQL), WORKER_AI_API_KEY, VERIFIER_AI_API_KEY, PORT, CORS_ORIGIN
npm install
npx prisma migrate dev   # after schema is final
npm run dev
```

Runs at `http://localhost:3001` by default.

### Frontend (Vercel / local)

```bash
cd frontend
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL to backend URL (e.g. http://localhost:3001)
npm install
npm run dev
```

Runs at `http://localhost:3000` by default.

## Deploy

- **Railway**: Connect repo, set root to `backend` (or deploy from `backend/`). Add PostgreSQL; set `WORKER_AI_API_KEY` and `VERIFIER_AI_API_KEY` (separate agents; optional `WORKER_AI_MODEL` / `VERIFIER_AI_MODEL`). Build: `npm run build`, Start: `npm run start`. Run `npx prisma migrate deploy` in release phase if needed.
- **Vercel**: Connect repo, set root to `frontend`. Set `NEXT_PUBLIC_API_URL` to the Railway API URL.

## Acceptance (spec §B)

- **Capture**: Dump items into Inbox; AI suggests classification and next action; one-click disposition (Next Action, Project, Waiting, Someday, Reference, Trash).
- **Vague task**: e.g. "Work on website" is rejected until clarified (valid next action required).
- **Project**: Must have outcome + at least one next action; otherwise stays CLARIFYING.
- **Done**: Task cannot be marked DONE without an evidence artifact and Verifier PASS (use task complete page to add draft then mark done).
- **Now list**: Ranked with reason tags; filters (time, energy, context); pin and snooze.
- **Weekly review**: Guided steps (Inbox, Projects without next action, Waiting, Someday, Focus); save up to 3 focus projects.
- **Daily check**: `/review/daily` shows inbox count, overdue, waiting follow-ups, projects without next action.
