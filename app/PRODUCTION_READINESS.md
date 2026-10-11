# Production readiness inspection

## Current architecture

| Area                        | Current implementation                                                          | Production status                             |
| --------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------- |
| Frontend                    | React + TypeScript + Vite                                                       | Vercel-compatible                             |
| API                         | Vercel handlers in `api/`                                                       | Added; requires Supabase variables            |
| Persistence                 | `localStorage` when API mode is disabled                                        | Not cross-device in fallback mode             |
| Technical scoring           | `api/attempts.ts` scores from Supabase `answer_index`                           | Server-side when API mode is enabled          |
| Technical question delivery | `api/technical-questions.ts` returns no answer index                            | Available; frontend must use it in production |
| Code execution              | No real executor; client demo plus fail-closed `/api/coding-submissions`        | Blocked until isolated executor is configured |
| SQL grading                 | Client structural check in demo                                                 | Production evaluator still required           |
| Web grading                 | Client structural check in demo                                                 | Production evaluator still required           |
| Leaderboard                 | Local fallback or `/api/leaderboard` projection                                 | Supabase route ready                          |
| Timer                       | Browser countdown in fallback; Supabase `deadline_at` enforced by technical API | Server enforcement exists in API mode         |

## Files added for deployment

- `api/attempts.ts`
- `api/technical-questions.ts`
- `api/leaderboard.ts`
- `api/coding-submissions.ts`
- `api/_lib/supabase.ts`
- `src/api.ts`
- `vercel.json`
- `.env.example`
- `.gitignore`

## Production switch

Set `VITE_API_ENABLED=true` in Vercel. The frontend will create attempts and submit technical answers through the API. If it is false, the app intentionally remains a same-browser demo using `localStorage`.

## Blocking manual steps

1. Create or connect a Vercel project with root directory `app`.
2. Apply the Supabase migration and seed `technical_questions` server-side.
3. Add the server-only Supabase variables to Vercel.
4. Split the frontend question data into a sanitized public bank before public production use. The current offline fallback still contains answer data for local demo scoring.
5. Deploy an isolated code executor and implement the adapter in `api/coding-submissions.ts`.
6. Set `CODE_EXECUTION_ENABLED=true` only after the adapter is tested with timeouts, output limits, and hidden tests.
7. Redeploy, then test two different devices using separate attempt tokens.

## Verification

- `npm run typecheck:api` passes.
- `npm run test` passes.
- `npm run build` passes.
- No production API route uses localhost or `127.0.0.1`.
- No credentials are committed in `.env.example`.
