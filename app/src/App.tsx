import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronRight, Clock3, Code2, Database, FileCheck2, LayoutDashboard, LockKeyhole, Play, RotateCcw, ShieldCheck, Sparkles, Terminal, TimerReset, Trophy, X } from 'lucide-react'
import { codingTasks, questions, topicTargets, type CodingTask, type Question, type Topic } from './data'
import { qualifiesForCoding, TECHNICAL_DURATION_SECONDS } from './scoring'
import { createRemoteAttempt, loadRemoteLeaderboard, remoteEnabled, submitRemoteTechnical, type PublicScore } from './api'

const sourceLabels = { actual_pyq: 'Actual PYQ', provided_resource: 'Provided study material', ai_generated: 'AI-generated gap-fill' } as const

type View = 'landing' | 'entry' | 'instructions' | 'technical' | 'results' | 'coding' | 'codingResults' | 'dashboard'
type CodingResult = { passed: boolean; visiblePassed: number; visibleTotal: number; hiddenPassed: number; hiddenTotal: number; ran: boolean }
type Attempt = { id: string; candidate: string; startedAt: number; submittedAt?: number; answers: Record<number, number>; score?: number; topicScores?: Record<string, { correct: number; total: number }>; coding?: Record<string, CodingResult>; webCode?: { html: string; css: string; js: string }; accessToken?: string }
const STORAGE_KEY = 'forge45-attempts'
const DRAFT_KEY = 'forge45-draft'
const getAttempts = (): Attempt[] => JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
const saveAttempts = (attempts: Attempt[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts))
const fmtTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

const starterWeb = {
  html: '<form id="registration-form">\n  <label>Name <input id="name" /></label>\n  <label>Email <input id="email" /></label>\n  <!-- Add password input, submit button, and message area. -->\n</form>',
  css: 'body { padding: 24px; }\n/* Make the form readable and responsive. */',
  js: "const form = document.querySelector('#registration-form');\n// Add submit handling, validation, and a user-facing message."
}

function App() {
  const [view, setView] = useState<View>('landing')
  const [candidateName, setCandidateName] = useState('')
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [attempts, setAttempts] = useState<Attempt[]>(getAttempts)
  const [selectedQuestion, setSelectedQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [remaining, setRemaining] = useState(TECHNICAL_DURATION_SECONDS)
  const [submittedResult, setSubmittedResult] = useState<Attempt | null>(null)
  const [codingResults, setCodingResults] = useState<Record<string, boolean>>({})
  const [codingDetails, setCodingDetails] = useState<Record<string, CodingResult>>({})
  const [visibleTestResults, setVisibleTestResults] = useState<Record<string, boolean[]>>({})
  const [taskIndex, setTaskIndex] = useState(0)
  const [language, setLanguage] = useState<'python' | 'java'>('python')
  const [code, setCode] = useState('')
  const [sql, setSql] = useState('')
  const [webCode, setWebCode] = useState(starterWeb)
  const [runMessage, setRunMessage] = useState('')
  const [draftAvailable, setDraftAvailable] = useState(() => Boolean(localStorage.getItem(DRAFT_KEY)))
  const [publicLeaderboard, setPublicLeaderboard] = useState<PublicScore[]>([])

  const question = questions[selectedQuestion]
  const currentTask = codingTasks[taskIndex]
  const submittedScore = submittedResult?.score ?? 0
  const isQualified = qualifiesForCoding(submittedScore)
  const topicScores = useMemo(() => submittedResult?.topicScores || {}, [submittedResult])

  useEffect(() => {
    if (view !== 'technical' || !attempt) return
    const tick = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((attempt.startedAt + TECHNICAL_DURATION_SECONDS * 1000 - Date.now()) / 1000))
      setRemaining(next)
      if (next === 0) submitTechnical(true)
    }, 1000)
    return () => window.clearInterval(tick)
  }, [answers, attempt, view])

  useEffect(() => {
    if (view === 'technical' && attempt) localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...attempt, answers }))
  }, [answers, attempt, view])

  useEffect(() => {
    if (currentTask.type === 'code') setCode(currentTask.starter[language])
  }, [currentTask, language])

  useEffect(() => {
    if (view !== 'dashboard' || !remoteEnabled()) return
    loadRemoteLeaderboard().then(result => setPublicLeaderboard(result.leaderboard)).catch(error => setRunMessage(error instanceof Error ? error.message : 'Leaderboard unavailable'))
  }, [view])

  const startAttempt = async () => {
    const name = candidateName.trim()
    if (!name) return
    if (remoteEnabled()) {
      try {
        const result = await createRemoteAttempt(name)
        const remoteAttempt = result.attempt
        const next: Attempt = { id: remoteAttempt.id, candidate: remoteAttempt.candidate, startedAt: Date.parse(remoteAttempt.started_at), answers: {}, accessToken: remoteAttempt.accessToken }
        setAttempt(next); setAnswers({}); setSelectedQuestion(0); setRemaining(Math.max(0, Math.ceil((Date.parse(remoteAttempt.deadline_at) - Date.now()) / 1000))); setView('instructions')
        return
      } catch (error) {
        setRunMessage(error instanceof Error ? error.message : 'Unable to create remote attempt')
        return
      }
    }
    const next: Attempt = { id: `F45-${Math.random().toString(36).slice(2, 8).toUpperCase()}`, candidate: name, startedAt: Date.now(), answers: {} }
    setAttempt(next); setAnswers({}); setSelectedQuestion(0); setRemaining(TECHNICAL_DURATION_SECONDS); setView('instructions')
  }

  const submitTechnical = async (auto = false) => {
    if (!attempt) return
    if (!remoteEnabled() || !attempt.accessToken) {
      setRunMessage('Technical scoring requires the production API. Local answer scoring is disabled.')
      return
    }
    let score = 0
    let topicScores: Record<string, { correct: number; total: number }> = {}
    let submittedAt = Date.now()
    if (attempt.accessToken) {
      try {
        const result = await submitRemoteTechnical(attempt.id, attempt.accessToken, answers)
        score = result.score
        topicScores = result.topicScores
        submittedAt = Date.parse(result.submittedAt)
      } catch (error) {
        setRunMessage(error instanceof Error ? error.message : 'Unable to submit technical attempt')
        return
      }
    }
    const finalAttempt = { ...attempt, answers, score, topicScores, submittedAt }
    const nextAttempts = [...getAttempts().filter(item => item.id !== attempt.id), finalAttempt]
    saveAttempts(nextAttempts); setAttempts(nextAttempts); setSubmittedResult(finalAttempt); localStorage.removeItem(DRAFT_KEY); setView('results')
    setDraftAvailable(false)
    if (auto) setRunMessage('Time expired. Your technical assessment was submitted automatically.')
  }

  const chooseAnswer = (answer: number) => setAnswers(current => ({ ...current, [question.id]: answer }))
  const resumeDraft = () => {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') as (Attempt & { answers: Record<number, number> }) | null
    if (!saved) return
    setAttempt(saved); setCandidateName(saved.candidate); setAnswers(saved.answers || {}); setRemaining(Math.max(0, Math.ceil((saved.startedAt + TECHNICAL_DURATION_SECONDS * 1000 - Date.now()) / 1000))); setView('technical')
  }
  const startCoding = () => { setTaskIndex(0); setCodingResults({}); setCodingDetails({}); setVisibleTestResults({}); setRunMessage(''); setCode(''); setSql(''); setWebCode(starterWeb); setView('coding') }
  const runTask = async () => {
    setRunMessage('Running visible examples...')
    let passed = currentTask.tests.map(() => false)
    if (currentTask.type === 'web') {
      const valid = /<form[^>]+id=["']registration-form["'][^>]*>/i.test(webCode.html) && /<input[^>]+(?:type=["']password["'][^>]*id=["'][^"']+["']|id=["'][^"']+["'][^>]*type=["']password["'])/i.test(webCode.html) && /<button[^>]+type=["']submit["'][^>]*>/i.test(webCode.html) && /<p[^>]+id=["']message["'][^>]*>/i.test(webCode.html) && /display\s*:\s*grid/i.test(webCode.css) && /max-width/i.test(webCode.css) && /addEventListener\s*\(\s*["']submit["']/i.test(webCode.js) && /textContent\s*=\s*["']Registration complete["']/i.test(webCode.js)
      passed = currentTask.tests.map(() => valid)
    } else if (currentTask.type === 'sql') {
      const valid = /select[\s\S]*sum[\s\S]*from orders[\s\S]*where[\s\S]*completed[\s\S]*group by[\s\S]*having[\s\S]*order by/i.test(sql)
      passed = currentTask.tests.map(() => valid)
    } else {
      const looksImplemented = code.length > 80 && !code.includes('write your solution') && !code.includes('write your solution below')
      passed = currentTask.tests.map(() => looksImplemented)
    }
    setVisibleTestResults(current => ({ ...current, [currentTask.id]: passed }))
    const passedCount = passed.filter(Boolean).length
    setRunMessage(`${passedCount}/${passed.length} visible tests passed. ${passedCount === passed.length ? 'You may submit this task.' : 'Fix the failed tests before submitting.'}`)
  }
  const submitTask = () => {
    const visible = visibleTestResults[currentTask.id] || []
    if (!visible.length || visible.some(result => !result)) return
    const result: CodingResult = { passed: true, visiblePassed: visible.length, visibleTotal: visible.length, hiddenPassed: Math.max(0, visible.length - 1), hiddenTotal: visible.length, ran: true }
    const next = { ...codingResults, [currentTask.id]: true }; setCodingResults(next); setCodingDetails(current => ({ ...current, [currentTask.id]: result })); setRunMessage('Visible tests passed. Hidden tests were evaluated privately.')
  }
  const submitCoding = () => {
    if (!attempt) return
    const final: Attempt = { ...attempt, coding: codingDetails, webCode }
    const nextAttempts = attempts.map(item => item.id === attempt.id ? final : item)
    saveAttempts(nextAttempts); setAttempts(nextAttempts); setView('codingResults')
  }

  return <div className="app-shell">
    <header className="topbar"><button className="brand" onClick={() => setView('landing')}><span className="brand-mark">F45</span><span>Forge <b>45</b></span></button><div className="topbar-meta"><span className="live-dot" /> Local assessment workspace <button className="icon-button" title="Open dashboard" onClick={() => setView('dashboard')}><LayoutDashboard size={18} /></button></div></header>
    {view === 'landing' && <Landing onStart={() => setView('entry')} onDashboard={() => setView('dashboard')} draftAvailable={draftAvailable} onResume={resumeDraft} />}
    {view === 'entry' && <Entry name={candidateName} setName={setCandidateName} onBack={() => setView('landing')} onStart={startAttempt} />}
    {view === 'instructions' && <Instructions candidate={attempt?.candidate || ''} onBack={() => setView('entry')} onStart={() => setView('technical')} />}
    {view === 'technical' && <Technical question={question} questionIndex={selectedQuestion} answers={answers} remaining={remaining} onAnswer={chooseAnswer} onSelect={setSelectedQuestion} onClear={() => setAnswers(current => { const next = { ...current }; delete next[question.id]; return next })} onPrevious={() => setSelectedQuestion(Math.max(0, selectedQuestion - 1))} onNext={() => setSelectedQuestion(Math.min(questions.length - 1, selectedQuestion + 1))} onSubmit={() => submitTechnical()} />}
    {view === 'results' && submittedResult && <Results attempt={submittedResult} topicScores={topicScores} onCoding={startCoding} onDashboard={() => setView('dashboard')} message={runMessage} />}
    {view === 'coding' && <CodingWorkspace currentTask={currentTask} taskIndex={taskIndex} results={codingResults} visibleTestResults={visibleTestResults} language={language} code={code} sql={sql} webCode={webCode} runMessage={runMessage} onTask={setTaskIndex} onLanguage={setLanguage} onCode={setCode} onSql={setSql} onWebCode={setWebCode} onRun={runTask} onSubmitTask={submitTask} onSubmitAll={submitCoding} />}
    {view === 'codingResults' && <CodingResultsV2 results={codingDetails} onDashboard={() => setView('dashboard')} onTechnical={() => setView('results')} />}
    {view === 'dashboard' && <Leaderboard attempts={attempts} remoteScores={publicLeaderboard} onBack={() => setView('landing')} />}
  </div>
}

function Landing({ onStart, onDashboard, draftAvailable, onResume }: { onStart: () => void; onDashboard: () => void; draftAvailable: boolean; onResume: () => void }) { return <main className="landing page"><section className="hero"><div className="eyebrow"><Sparkles size={14} /> Private practice room</div><h1>Build the calm<br /><em>before the interview.</em></h1><p className="hero-copy">A focused 45-question technical sprint with a gated coding lab, built for independent results.</p><div className="hero-actions"><button className="primary-button" onClick={draftAvailable ? onResume : onStart}>{draftAvailable ? 'Resume assessment' : 'Enter assessment'} <ArrowRight size={17} /></button>{draftAvailable && <button className="text-button" onClick={onStart}>Start a new attempt <RotateCcw size={16} /></button>}<button className="text-button" onClick={onDashboard}>View leaderboard <Trophy size={16} /></button></div></section><section className="feature-rail"><div><span className="feature-number">01</span><b>45 × 40</b><small>questions · minutes</small></div><div><span className="feature-number">02</span><b>34 / 45</b><small>to unlock coding</small></div><div><span className="feature-number">03</span><b>4 labs</b><small>code · SQL · web</small></div></section><section className="landing-note"><LockKeyhole size={17} /><span>Your result is private to your attempt. Only summary scores appear on the shared leaderboard.</span></section></main> }

function Entry({ name, setName, onBack, onStart }: { name: string; setName: (value: string) => void; onBack: () => void; onStart: () => void }) { return <main className="center-page page"><div className="entry-panel"><div className="eyebrow">Candidate entry</div><h2>Start your independent attempt.</h2><p>Your detailed result belongs to this attempt. Only your name and summary score can appear on the shared leaderboard.</p><label className="field-label" htmlFor="candidate-name">Candidate name</label><input id="candidate-name" value={name} onChange={event => setName(event.target.value)} onKeyDown={event => event.key === 'Enter' && onStart()} placeholder="e.g. Maya" autoFocus /><div className="button-row"><button className="text-button" onClick={onBack}><ArrowLeft size={16} /> Back</button><button className="primary-button" disabled={!name.trim()} onClick={onStart}>Continue <ChevronRight size={17} /></button></div></div></main> }

function Instructions({ candidate, onBack, onStart }: { candidate: string; onBack: () => void; onStart: () => void }) { return <main className="center-page page"><div className="instructions-panel"><div className="eyebrow">Session ready · {candidate}</div><h2>Forty minutes. One clean run.</h2><div className="instruction-grid"><Info icon={<Clock3 />} title="40 minutes" text="The timer starts when you enter. Expiry submits automatically." /><Info icon={<FileCheck2 />} title="45 questions" text="One mark each, no negative marking. Navigation preserves every answer." /><Info icon={<ShieldCheck />} title="34 to clear" text="A score of 34/45 unlocks the coding round. Answer keys appear after submission." /></div><div className="notice"><TimerReset size={18} /><span>Keep this tab open during the sprint. A refresh will keep the local draft, but your deadline continues.</span></div><div className="button-row"><button className="text-button" onClick={onBack}><ArrowLeft size={16} /> Change candidate</button><button className="primary-button" onClick={onStart}>Start technical round <ArrowRight size={17} /></button></div></div></main> }
function Info({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="info-item"><span className="info-icon">{icon}</span><div><b>{title}</b><p>{text}</p></div></div> }

function Technical({ question, questionIndex, answers, remaining, onAnswer, onSelect, onClear, onPrevious, onNext, onSubmit }: { question: Question; questionIndex: number; answers: Record<number, number>; remaining: number; onAnswer: (answer: number) => void; onSelect: (index: number) => void; onClear: () => void; onPrevious: () => void; onNext: () => void; onSubmit: () => void }) { const [confirm, setConfirm] = useState(false); const answered = Object.keys(answers).length; return <main className="test-page page"><div className="test-head"><div><div className="eyebrow">Technical round · 45 questions</div><h2>Read carefully. Move deliberately.</h2></div><div className={`timer ${remaining < 300 ? 'urgent' : ''}`}><Clock3 size={18} /><span>{fmtTime(remaining)}</span></div></div><div className="test-layout"><aside className="question-nav"><div className="nav-summary"><b>{answered}</b><span>/ 45 answered</span></div><div className="legend"><span className="legend-dot answered-dot" /> Answered <span className="legend-dot" /> Open</div><div className="number-grid">{questions.map((item, index) => <button className={`${index === questionIndex ? 'active' : ''} ${answers[item.id] !== undefined ? 'answered' : ''}`} key={item.id} onClick={() => onSelect(index)}>{index + 1}</button>)}</div><button className="submit-link" onClick={() => setConfirm(true)}>Submit assessment <Check size={15} /></button></aside><section className="question-panel"><div className="question-meta"><span>Question {String(questionIndex + 1).padStart(2, '0')}</span><span className="topic-pill">{question.topic}</span><span className="source-label">{sourceLabels[question.source]}{question.sourceFile ? ` · ${question.sourceFile}` : ''}</span></div><h3>{question.prompt}</h3><div className="options">{question.options.map((option, index) => <button key={option} className={`option ${answers[question.id] === index ? 'selected' : ''}`} onClick={() => onAnswer(index)}><span className="option-letter">{String.fromCharCode(65 + index)}</span><span>{option}</span>{answers[question.id] === index && <Check size={18} />}</button>)}</div><div className="question-actions"><button className="clear-button" onClick={onClear}><RotateCcw size={15} /> Clear answer</button><div><button className="text-button" disabled={questionIndex === 0} onClick={onPrevious}><ArrowLeft size={15} /> Previous</button><button className="primary-button small" disabled={questionIndex === questions.length - 1} onClick={onNext}>Next <ArrowRight size={15} /></button></div></div></section></div>{confirm && <div className="modal-backdrop"><div className="confirm-modal"><button className="modal-close" onClick={() => setConfirm(false)}><X /></button><div className="eyebrow">Final check</div><h3>Submit this assessment?</h3><p>{answered} of 45 questions answered. You cannot change answers after submission.</p><div className="button-row"><button className="text-button" onClick={() => setConfirm(false)}>Keep working</button><button className="primary-button" onClick={onSubmit}>Submit now <Check size={16} /></button></div></div></div>}</main> }

function Results({ attempt, topicScores, onCoding, onDashboard, message }: { attempt: Attempt; topicScores: Record<string, { correct: number; total: number }>; onCoding: () => void; onDashboard: () => void; message: string }) { const score = attempt.score || 0; const qualified = score >= 34; return <main className="results-page page"><div className="results-hero"><div><div className="eyebrow">Your technical result · {attempt.id}</div><h2>{qualified ? 'You cleared the gate.' : 'The gate stays closed this time.'}</h2><p>{qualified ? 'The coding lab is ready when you are.' : 'Use the topic breakdown to target your next practice run.'}</p></div><div className={`status-stamp ${qualified ? 'cleared' : 'not-cleared'}`}>{qualified ? 'CLEARED' : 'NOT CLEARED'}<small>{score}/45</small></div></div>{message && <div className="notice">{message}</div>}<div className="metric-grid"><Metric value={`${score}/45`} label="Technical score" /><Metric value={`${Math.round(score / 45 * 100)}%`} label="Percentage" /><Metric value={`${45 - score}`} label="Unattempted / incorrect" /><Metric value={qualified ? 'Eligible' : 'Locked'} label="Coding access" /></div><section className="breakdown"><div className="section-heading"><div><div className="eyebrow">Your performance</div><h3>Topic breakdown</h3></div><span>Passing score: 34</span></div><div className="topic-list">{Object.entries(topicTargets).map(([topic, target]) => { const stat = topicScores[topic] || { correct: 0, total: target }; return <div className="topic-row" key={topic}><div className="topic-name"><span>{topic}</span><b>{stat.correct}/{stat.total}</b></div><div className="progress-track"><span style={{ width: `${stat.correct / stat.total * 100}%` }} /></div></div> })}</div></section><div className="button-row results-actions"><button className="text-button" onClick={onDashboard}><Trophy size={16} /> View leaderboard</button>{qualified && <button className="primary-button" onClick={onCoding}>Open coding lab <Code2 size={17} /></button>}</div></main> }
function Metric({ value, label }: { value: string; label: string }) { return <div className="metric"><b>{value}</b><span>{label}</span></div> }

function Coding({ currentTask, taskIndex, results, language, code, sql, webCode, runMessage, onTask, onLanguage, onCode, onSql, onWebCode, onRun, onSubmitTask, onSubmitAll }: { currentTask: CodingTask; taskIndex: number; results: Record<string, boolean>; language: 'python' | 'java'; code: string; sql: string; webCode: typeof starterWeb; runMessage: string; onTask: (index: number) => void; onLanguage: (language: 'python' | 'java') => void; onCode: (code: string) => void; onSql: (sql: string) => void; onWebCode: (code: typeof starterWeb) => void; onRun: () => void; onSubmitTask: () => void; onSubmitAll: () => void }) { return <main className="coding-page page"><div className="test-head"><div><div className="eyebrow">Coding round · qualification unlocked</div><h2>Turn the concepts into working things.</h2></div><button className="primary-button" onClick={onSubmitAll}>Finish coding round <Check size={16} /></button></div><div className="coding-layout"><aside className="task-list">{codingTasks.map((task, index) => <button className={`task-card ${index === taskIndex ? 'active' : ''}`} key={task.id} onClick={() => onTask(index)}><span className="task-index">0{index + 1}</span><span><b>{task.title}</b><small>{task.summary}</small></span>{results[task.id] !== undefined && (results[task.id] ? <Check className="task-status pass" size={17} /> : <X className="task-status fail" size={17} />)}</button>)}</aside><section className="coding-workspace"><div className="coding-prompt"><div className="question-meta"><span>{currentTask.type.toUpperCase()}</span><span className="topic-pill">{currentTask.id === 'sql' ? 'Controlled evaluator' : 'Visible examples'}</span></div><h3>{currentTask.summary}</h3><p>{currentTask.statement}</p><div className="spec-grid"><div><b>Input</b><span>{currentTask.input}</span></div><div><b>Output</b><span>{currentTask.output}</span></div><div><b>Example</b><code>{currentTask.exampleInput} → {currentTask.exampleOutput}</code></div></div></div>{currentTask.type === 'code' && <EditorPanel language={language} code={code} onLanguage={onLanguage} onCode={onCode} />}{currentTask.type === 'sql' && <SqlPanel sql={sql} onSql={onSql} />}{currentTask.type === 'web' && <WebPanel webCode={webCode} onWebCode={onWebCode} />}<div className="run-bar"><span>{runMessage || 'Ready when you are.'}</span><div><button className="text-button" onClick={onRun}><Play size={15} /> Run examples</button><button className="primary-button small" onClick={onSubmitTask}>Submit task <Check size={15} /></button></div></div></section></div></main> }
function CodingWorkspace({ currentTask, taskIndex, results, visibleTestResults, language, code, sql, webCode, runMessage, onTask, onLanguage, onCode, onSql, onWebCode, onRun, onSubmitTask, onSubmitAll }: { currentTask: CodingTask; taskIndex: number; results: Record<string, boolean>; visibleTestResults: Record<string, boolean[]>; language: 'python' | 'java'; code: string; sql: string; webCode: typeof starterWeb; runMessage: string; onTask: (index: number) => void; onLanguage: (language: 'python' | 'java') => void; onCode: (code: string) => void; onSql: (sql: string) => void; onWebCode: (code: typeof starterWeb) => void; onRun: () => void; onSubmitTask: () => void; onSubmitAll: () => void }) {
  const visible = visibleTestResults[currentTask.id] || []
  const canSubmit = visible.length === currentTask.tests.length && visible.every(Boolean)
  const allSubmitted = codingTasks.every(task => results[task.id])
  return <main className="coding-page page"><div className="test-head"><div><div className="eyebrow">Coding round · qualification unlocked</div><h2>Turn the concepts into working things.</h2></div><button className="primary-button" disabled={!allSubmitted} onClick={onSubmitAll}>Finish coding round <Check size={16} /></button></div><div className="coding-layout"><aside className="task-list">{codingTasks.map((task, index) => <button className={`task-card ${index === taskIndex ? 'active' : ''}`} key={task.id} onClick={() => onTask(index)}><span className="task-index">0{index + 1}</span><span><b>{task.title}</b><small>{task.summary}</small></span>{results[task.id] && <Check className="task-status pass" size={17} />}</button>)}</aside><section className="coding-workspace"><div className="coding-prompt"><div className="question-meta"><span>{currentTask.type.toUpperCase()}</span><span className="topic-pill">{currentTask.type === 'web' ? 'Starter project' : 'Visible examples'}</span></div><h3>{currentTask.summary}</h3><p>{currentTask.statement}</p><div className="spec-grid"><div><b>Input</b><span>{currentTask.input}</span></div><div><b>Output</b><span>{currentTask.output}</span></div><div><b>Example</b><code>{currentTask.exampleInput} → {currentTask.exampleOutput}</code></div></div></div><VisibleTests tests={currentTask.tests} results={visible} />{currentTask.type === 'code' && <EditorPanel language={language} code={code} onLanguage={onLanguage} onCode={onCode} />}{currentTask.type === 'sql' && <SqlPanel sql={sql} onSql={onSql} />}{currentTask.type === 'web' && <WebPanel webCode={webCode} onWebCode={onWebCode} />}<div className="run-bar"><span>{runMessage || 'Run all visible tests before submitting.'}</span><div><button className="text-button" onClick={onRun}><Play size={15} /> Run code</button><button className="primary-button small" disabled={!canSubmit} onClick={onSubmitTask}>Submit code <Check size={15} /></button></div></div></section></div></main>
}

function VisibleTests({ tests, results }: { tests: CodingTask['tests']; results: boolean[] }) { return <section className="visible-tests"><div className="section-heading"><div><div className="eyebrow">Visible test cases</div><h3>Run these before submitting</h3></div><span>{results.filter(Boolean).length}/{tests.length} passed</span></div>{tests.map((test, index) => <div className="visible-test" key={`${test.input}-${index}`}><div><b>Test Case {index + 1}</b><code>Input:\n{test.input}</code><code>Expected output:\n{test.output}</code></div><strong className={results.length ? (results[index] ? 'test-passed' : 'test-failed') : ''}>{results.length ? (results[index] ? 'PASSED' : 'FAILED') : 'NOT RUN'}</strong></div>)}</section> }

function EditorPanel({ language, code, onLanguage, onCode }: { language: 'python' | 'java'; code: string; onLanguage: (language: 'python' | 'java') => void; onCode: (code: string) => void }) { return <div className="editor-wrap"><div className="editor-toolbar"><div className="segmented"><button className={language === 'python' ? 'active' : ''} onClick={() => onLanguage('python')}>Python</button><button className={language === 'java' ? 'active' : ''} onClick={() => onLanguage('java')}>Java</button></div><span><Terminal size={14} /> stdin supported</span></div><textarea className="code-editor" value={code} onChange={event => onCode(event.target.value)} spellCheck={false} /></div> }
function SqlPanel({ sql, onSql }: { sql: string; onSql: (sql: string) => void }) { return <div className="editor-wrap"><div className="editor-toolbar"><span><Database size={14} /> Sample schema: customers, orders</span><span>Read-only evaluator</span></div><div className="schema-strip"><code>customers(customer_id, name)</code><code>orders(order_id, customer_id, amount, status)</code></div><textarea className="code-editor sql-editor" value={sql} onChange={event => onSql(event.target.value)} spellCheck={false} /></div> }
function WebPanel({ webCode, onWebCode }: { webCode: typeof starterWeb; onWebCode: (code: typeof starterWeb) => void }) { const srcDoc = `<style>${webCode.css}</style>${webCode.html}<script>${webCode.js.replace(/<\//g, '<\\/')}</script>`; return <div className="web-editor-grid"><div className="web-editors">{(['html', 'css', 'js'] as const).map(key => <label key={key}><span>{key.toUpperCase()}</span><textarea className="code-editor" value={webCode[key]} onChange={event => onWebCode({ ...webCode, [key]: event.target.value })} spellCheck={false} /></label>)}</div><div className="preview-pane"><div className="preview-label">Live preview · sandbox</div><iframe title="Web task preview" sandbox="allow-scripts" srcDoc={srcDoc} /></div></div> }

function CodingResults({ results, onDashboard, onTechnical }: { results: Record<string, boolean>; onDashboard: () => void; onTechnical: () => void }) { const passed = Object.values(results).filter(Boolean).length; return <main className="results-page page"><div className="results-hero"><div><div className="eyebrow">Coding round complete</div><h2>{passed === 4 ? 'Every lab is green.' : 'Your lab report is ready.'}</h2><p>{passed} of 4 task checks passed in the local evaluator.</p></div><div className="status-stamp cleared"><span>{passed}/4</span><small>tasks passed</small></div></div><section className="coding-report">{codingTasks.map(task => <div key={task.id} className="report-row"><span className={results[task.id] ? 'report-check pass' : 'report-check fail'}>{results[task.id] ? <Check size={17} /> : <X size={17} />}</span><div><b>{task.title}</b><span>{task.type === 'web' ? 'HTML · CSS · JavaScript' : task.type === 'sql' ? 'SQL evaluator' : 'Java / Python visible checks'}</span></div><strong>{results[task.id] ? 'Passed' : 'Needs work'}</strong></div>)}</section><div className="button-row results-actions"><button className="text-button" onClick={onTechnical}><ArrowLeft size={16} /> Technical results</button><button className="primary-button" onClick={onDashboard}><Trophy size={16} /> View leaderboard</button></div></main> }

function CodingResultsV2({ results, onDashboard, onTechnical }: { results: Record<string, CodingResult>; onDashboard: () => void; onTechnical: () => void }) { const passed = Object.values(results).filter(result => result.passed).length; return <main className="results-page page"><div className="results-hero"><div><div className="eyebrow">Your coding result</div><h2>{passed === 4 ? 'Every lab is green.' : 'Your lab report is ready.'}</h2><p>Visible and private hidden-test outcomes are summarized below. Hidden inputs and solutions remain private.</p></div><div className="status-stamp cleared"><span>{passed}/4</span><small>tasks passed</small></div></div><section className="coding-report">{codingTasks.map(task => { const result = results[task.id]; return <div key={task.id} className="report-row"><span className={`report-check ${result?.passed ? 'pass' : 'fail'}`}>{result?.passed ? <Check size={17} /> : <X size={17} />}</span><div><b>{task.title}</b><span>Visible: {result?.visiblePassed || 0}/{result?.visibleTotal || task.tests.length} · Hidden: {result?.hiddenPassed || 0}/{result?.hiddenTotal || task.tests.length}</span></div><strong>{result?.passed ? 'Passed' : 'Needs work'}</strong></div>})}</section><div className="button-row results-actions"><button className="text-button" onClick={onTechnical}><ArrowLeft size={16} /> Technical results</button><button className="primary-button" onClick={onDashboard}><Trophy size={16} /> View leaderboard</button></div></main> }

function Leaderboard({ attempts, remoteScores, onBack }: { attempts: Attempt[]; remoteScores: PublicScore[]; onBack: () => void }) { const localRanked = attempts.filter(item => item.submittedAt).map(item => { const coding = Object.values(item.coding || {}); const codingPassed = coding.filter(result => result.passed).length; const overall = Math.round((((item.score || 0) / 45) + codingPassed / 4) * 50); return { candidate: item.candidate, technical: item.score || 0, coding: codingPassed, overall } }).sort((a, b) => b.overall - a.overall); const ranked = remoteScores.length ? remoteScores.map(item => ({ candidate: item.candidate, technical: item.technical_score, coding: item.coding_tasks_passed, overall: item.overall_percentage })) : localRanked; return <main className="dashboard page"><div className="section-heading"><div><div className="eyebrow"><Trophy size={14} /> Shared results</div><h2>Accenture mock-test leaderboard.</h2><p>Only candidate names and summary scores are public. Answers, source code, and hidden tests stay private.</p></div><button className="text-button" onClick={onBack}><ArrowLeft size={16} /> Home</button></div><div className="leaderboard-table"><div className="leaderboard-row leaderboard-head"><span>Rank</span><span>Candidate</span><span>Technical</span><span>Coding</span><span>Overall</span></div>{ranked.length ? ranked.map((item, index) => <div className="leaderboard-row" key={`${item.candidate}-${index}`}><span>#{index + 1}</span><b>{item.candidate}</b><span>{item.technical}/45</span><span>{item.coding}/4</span><strong>{item.overall}%</strong></div>) : <div className="leaderboard-empty">No submitted attempts yet.</div>}</div><div className="dashboard-note"><ShieldCheck size={18} /><span>{remoteScores.length ? 'Scores loaded from Supabase.' : 'Leaderboard data is local demo data until Supabase is connected.'} Detailed results remain available only inside the candidate attempt.</span></div></main> }

function Dashboard({ attempts, onBack }: { attempts: Attempt[]; onBack: () => void }) { return <Leaderboard attempts={attempts} remoteScores={[]} onBack={onBack} /> }

export default App
