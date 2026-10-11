# Forge 45

A responsive Accenture-style technical assessment and coding practice room for two candidates.

## Project structure

- `src/App.tsx` - assessment, individual results, coding lab, preview, and leaderboard screens
- `src/data.ts` - extracted 45-question bank, topic distribution, and four coding tasks
- `scripts/extract_resources.py` - repeatable DOCX extraction and question-bank curation
- `data/questions.json` - generated question records with source metadata
- `QUESTION_BANK_REPORT.md` - admin/source report
- `DEPLOYMENT_ARCHITECTURE.md` - Vercel/Supabase deployment boundary and setup
- `TECHNICAL_ANSWER_KEY.md` - post-submission technical answers and explanations
- `CODING_SOLUTIONS.md` - developer-only reference solutions and test cases for all four coding tasks; it is not imported by the frontend
- `src/scoring.ts` - shared 34/45 qualification rule
- `src/scoring.test.ts` - critical scoring tests
- `supabase/migrations/` - PostgreSQL schema and starter RLS policies
- `api/attempts.ts` - Vercel serverless attempt creation and server-side technical scoring
- `api/technical-questions.ts` - sanitized question delivery without answer keys
- `api/leaderboard.ts` - score-only public leaderboard endpoint
- `api/coding-submissions.ts` - fail-closed coding submission boundary
- `scripts/generate_supabase_seed.py` - reproducible private question seed generator
- `supabase/seed.sql` - generated, rerunnable seed for all 45 technical questions
- `RESOURCE_AUDIT.md` - audit of the supplied study archive

## Technologies

React, TypeScript, Vite, Lucide icons, CSS, Vitest, and Supabase-ready PostgreSQL migrations.

## Installation and local run

```powershell
cd app
npm install
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`.

## Build and tests

```powershell
npm run test
npm run build
npm run preview
```

The local demo persists submitted attempt summaries in browser storage. Each candidate has an independent attempt and detailed result view; the shared leaderboard exposes only name and summary scores. The browser-local layer is not a production security boundary.

## Supabase setup

1. Create a Supabase project.
2. Apply `supabase/migrations/202610110001_forge45_schema.sql` with the Supabase SQL editor or Supabase CLI.
3. Run `python scripts/generate_supabase_seed.py` after changing the private bank, then apply `supabase/seed.sql`. It uses `on conflict (id) do update`, so rerunning it does not duplicate questions. Do not ship `answer_index` to an unauthenticated browser.
4. Add Supabase Auth and server routes that create candidate identities, save answers, score submissions on the server, and return only the candidate's own result.
5. Set `VITE_API_ENABLED=true` in Vercel. `App.tsx` then creates attempts and submits technical answers through `/api/attempts`, and loads `/api/leaderboard`. The public leaderboard endpoint returns only candidate display name, technical score, coding task count, and overall score.

The supplied migration enables RLS and intentionally avoids anonymous policies for answer keys and hidden coding tests. The starter policies assume authenticated candidates and should be reviewed against the final Auth identity model before deployment.

The technical round is exactly 45 questions in 40 minutes. The server/API layer must set and enforce each attempt deadline at 40 minutes from `started_at`; the client countdown is only a presentation aid.

## Environment variables

Copy `.env.example` to `.env.local` and fill in only local public client values. Never put a Supabase service-role key in browser variables or source control.

- `VITE_SUPABASE_URL` - public project URL
- `VITE_SUPABASE_ANON_KEY` - public anon key, only with correct RLS
- `VITE_API_ENABLED` - set `true` in the deployed frontend
- `VITE_API_BASE_URL` - normally `/api`
- `PISTON_URL` - server-side execution endpoint, default can be `https://emkc.org/api/v2/piston/execute`
- `SUPABASE_URL` - server-only project URL used by Vercel API routes
- `SUPABASE_SERVICE_ROLE_KEY` - server-only Supabase key; never use a `VITE_` prefix
- `CODE_EXECUTION_ENABLED` - keep `false` until an isolated executor adapter is deployed

## Piston and code execution

The coding UI starts with boilerplate/incomplete code, shows three visible test cases, and disables `Submit code` until all visible tests have been run successfully. `api/coding-submissions.ts` deliberately fails closed until a server-side Piston/self-hosted sandbox adapter is implemented. Do not enable `CODE_EXECUTION_ENABLED` until that adapter enforces language allowlists, timeouts, output limits, quotas, and server-side hidden tests.

## Deployment

Build with `npm run build` and deploy the generated `dist` folder to Vercel, Netlify, or static hosting. For Vercel, set the project root to `app`; `vercel.json` provides SPA fallback routing. Configure the public environment values in the host. Deploy Supabase separately and apply the migration before enabling cross-device attempts. See `DEPLOYMENT_ARCHITECTURE.md` for the requested two-device flow.

## Sharing

For a real public link, deploy the frontend and the server/API layer separately, then share the hosting URL. The local browser demo is suitable for a same-device walkthrough, not cross-device persistence.

## Testing checklist

Run `python scripts/extract_resources.py` after changing the source archive; it regenerates `data/questions.json` and `data/resource_extraction_report.json`. The extracted bank is source-backed first and only uses `ai_generated` for explicit gap-fill records.

The automated test covers the exact threshold and answer-index scoring. The production build passes locally. Manual browser checks should cover timer expiry, navigation, clear answer, qualification gating, blank/incomplete coding starters, three visible tests, submit gating, sandboxed web preview, independent result pages, leaderboard summaries, refresh persistence, and mobile layout. External Supabase and Piston execution remain unconfigured in this workspace and are not claimed as tested.

## Troubleshooting

- If the port is busy, run `npm run dev -- --port 5174`.
- If answers disappear, confirm browser storage is enabled; configured Supabase should replace this demo layer.
- If the preview is blank, check the HTML/JS editor for syntax errors and remember that the iframe is sandboxed.
- If production deployment shows a blank page on refresh, configure SPA fallback to `index.html`.
