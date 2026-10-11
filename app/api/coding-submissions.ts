import { json, requestBody, getAdminClient } from './_lib/supabase'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })
  if (process.env.CODE_EXECUTION_ENABLED !== 'true') return json(res, 503, { error: 'Server-side code execution is not configured. Set CODE_EXECUTION_ENABLED only after connecting an isolated executor.' })
  const body = requestBody(req)
  if (!body.attemptId || !body.accessToken || !body.taskId) return json(res, 400, { error: 'Attempt credentials and task are required' })
  // Deliberately fail closed until the server-side Piston adapter is installed.
  // Client-provided pass/fail values are never accepted here.
  void getAdminClient
  return json(res, 501, { error: 'Coding executor adapter is not implemented yet' })
}
