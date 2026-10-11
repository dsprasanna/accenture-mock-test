import { getAdminClient, json } from './_lib/supabase'

export default async function handler(_req: any, res: any) {
  if (_req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' })
  try {
    const { data, error } = await getAdminClient().from('technical_questions').select('id, topic, prompt, options, difficulty, source, source_file, source_location').order('id')
    if (error) throw error
    return json(res, 200, { questions: data || [] })
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : 'Unable to load questions' })
  }
}
