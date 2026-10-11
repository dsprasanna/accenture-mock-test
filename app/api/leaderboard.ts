import { getAdminClient, json } from './_lib/supabase'

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
  try {
    const { data, error } = await getAdminClient().from('public_leaderboard').select('candidate, technical_score, coding_tasks_passed, overall_percentage')
    if (error) throw error
    return json(res, 200, { leaderboard: data || [] })
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : 'Unable to load leaderboard' })
  }
}
