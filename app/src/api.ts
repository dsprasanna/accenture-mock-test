export type RemoteAttempt = { id: string; candidate: string; session_code: string; started_at: string; deadline_at: string; accessToken: string }
export type PublicScore = { candidate: string; technical_score: number; coding_tasks_passed: number; overall_percentage: number }

const enabled = import.meta.env.VITE_API_ENABLED === 'true'
const base = import.meta.env.VITE_API_BASE_URL || '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, { headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }, ...init })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`)
  return body as T
}

export const remoteEnabled = () => enabled
export const createRemoteAttempt = (candidate: string) => request<{ attempt: RemoteAttempt }>('/attempts', { method: 'POST', body: JSON.stringify({ candidate }) })
export const submitRemoteTechnical = (attemptId: string, accessToken: string, answers: Record<number, number>) => request<{ score: number; qualified: boolean; topicScores: Record<string, { correct: number; total: number }>; submittedAt: string }>('/attempts', { method: 'PATCH', body: JSON.stringify({ attemptId, accessToken, answers }) })
export const loadRemoteLeaderboard = () => request<{ leaderboard: PublicScore[] }>('/leaderboard')
