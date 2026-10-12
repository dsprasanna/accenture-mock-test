import { createHash, randomBytes } from 'node:crypto'
import { getAdminClient, json, requestBody } from './_lib/supabase.js'

const DURATION_MS = 40 * 60 * 1000
const PASSING_SCORE = 34
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const cleanName = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 80) : ''

async function createAttempt(req: any, res: any) {
  const body = requestBody(req)
  const candidate = cleanName(body.candidate)
  if (!candidate) return json(res, 400, { error: 'Candidate name is required' })
  const admin = getAdminClient()
  const accessToken = randomBytes(32).toString('hex')
  const startedAt = new Date()
  const deadlineAt = new Date(startedAt.getTime() + DURATION_MS)
  const { data: candidateRow, error: candidateError } = await admin.from('candidates').insert({ display_name: candidate }).select('id, display_name').single()
  if (candidateError) throw candidateError
  const { data: attempt, error: attemptError } = await admin.from('test_attempts').insert({ candidate_id: candidateRow.id, session_code: `F45-${randomBytes(4).toString('hex').toUpperCase()}`, access_token_hash: hash(accessToken), started_at: startedAt.toISOString(), deadline_at: deadlineAt.toISOString() }).select('id, session_code, started_at, deadline_at').single()
  if (attemptError) throw attemptError
  return json(res, 201, { attempt: { ...attempt, candidate: candidateRow.display_name, accessToken } })
}

async function submitTechnical(req: any, res: any) {
  const body = requestBody(req)
  const attemptId = typeof body.attemptId === 'string' ? body.attemptId : ''
  const accessToken = typeof body.accessToken === 'string' ? body.accessToken : ''
  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {}
  if (!attemptId || !accessToken) return json(res, 400, { error: 'Attempt credentials are required' })
  const admin = getAdminClient()
  const { data: attempt, error: attemptError } = await admin.from('test_attempts').select('id, candidate_id, started_at, deadline_at, status').eq('id', attemptId).eq('access_token_hash', hash(accessToken)).single()
  if (attemptError || !attempt) return json(res, 404, { error: 'Attempt not found' })
  if (attempt.status !== 'active') return json(res, 409, { error: 'Attempt is already submitted' })
  const now = Date.now()
  if (now > Date.parse(attempt.deadline_at)) return json(res, 409, { error: 'Technical deadline has expired' })
  const { data: questions, error: questionError } = await admin.from('technical_questions').select('id, topic, answer_index').order('id')
  if (questionError) throw questionError
  const answerRows = (questions || []).map(question => ({ attempt_id: attemptId, question_id: question.id, selected_index: Number.isInteger(answers[question.id]) ? answers[question.id] : null }))
  const { error: answerWriteError } = await admin.from('technical_answers').upsert(answerRows)
  if (answerWriteError) throw answerWriteError
  const topicTotals: Record<string, { correct: number; total: number }> = {}
  let score = 0
  for (const question of questions || []) {
    const selected = answers[question.id]
    const correct = selected === question.answer_index
    score += correct ? 1 : 0
    topicTotals[question.topic] ||= { correct: 0, total: 0 }
    topicTotals[question.topic].total += 1
    topicTotals[question.topic].correct += correct ? 1 : 0
  }
  const { error: topicScoreError } = await admin.from('topic_scores').upsert(Object.entries(topicTotals).map(([topic, value]) => ({ attempt_id: attemptId, topic, ...value })))
  if (topicScoreError) throw topicScoreError
  const { error: updateError } = await admin.from('test_attempts').update({ score, status: 'submitted', submitted_at: new Date().toISOString() }).eq('id', attemptId)
  if (updateError) throw updateError
  return json(res, 200, { score, qualified: score >= PASSING_SCORE, topicScores: topicTotals, submittedAt: new Date().toISOString() })
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'POST') return createAttempt(req, res)
    if (req.method === 'PATCH') return submitTechnical(req, res)
    return json(res, 405, { error: 'Method not allowed' })
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : 'Attempt service failed' })
  }
}
