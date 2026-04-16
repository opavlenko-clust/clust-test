'use client'

import { useEffect, useRef, useState } from 'react'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type Stage = 'chat' | 'confirm' | 'deploying' | 'deployed'

type Step = {
  label: string
  status: 'pending' | 'active' | 'done' | 'error'
  detail?: string
}

export default function FeatureAgent() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Привіт! Опиши що треба зробити і я уточню деталі перед запуском.',
    },
  ])
  const [input, setInput] = useState('')
  const [stage, setStage] = useState<Stage>('chat')
  const [loading, setLoading] = useState(false)
  const [branch, setBranch] = useState('')
  const [stagingUrl, setStagingUrl] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [steps, setSteps] = useState<Step[]>([])
  const [buildElapsed, setBuildElapsed] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, steps])

  // Build elapsed timer
  useEffect(() => {
    if (stage === 'deploying') {
      setBuildElapsed(0)
      timerRef.current = setInterval(() => setBuildElapsed(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [stage])

  function setStep(label: string, status: Step['status'], detail?: string) {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.label === label)
      if (idx === -1) return [...prev, { label, status, detail }]
      const next = [...prev]
      next[idx] = { label, status, detail }
      return next
    })
  }

  // Poll Vercel for preview URL after branch is created
  useEffect(() => {
    if (stage !== 'deploying' || !branch) return

    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/admin/feature-agent/status?branch=${encodeURIComponent(branch)}`)
      const data = await res.json()

      if (data.state === 'NO_VERCEL') {
        clearInterval(pollRef.current!)
        setStep('Vercel build', 'done', 'Vercel не підключено — код на GitHub')
        setGithubUrl(data.githubUrl)
        setStage('deployed')
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `✅ Код запушено на GitHub\n\nГілка: ${data.githubUrl}` },
        ])
      } else if (data.state === 'READY' && data.url) {
        clearInterval(pollRef.current!)
        setStep('Vercel build', 'done', data.url)
        setStagingUrl(data.url)
        setStage('deployed')
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `✅ Задеплоєно на staging\n\nПеревір: ${data.url}` },
        ])
      } else if (data.state === 'ERROR') {
        clearInterval(pollRef.current!)
        setStep('Vercel build', 'error', data.errorMessage ?? 'Build failed')
        setStage('confirm')
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: '❌ Деплой впав. Спробуй ще раз або уточни задачу.' },
        ])
      } else {
        const label = data.state === 'BUILDING' ? 'Vercel будує...' : 'Очікуємо Vercel...'
        setStep('Vercel build', 'active', label)
      }
    }, 4000)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [stage, branch])

  async function sendMessage() {
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/admin/feature-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      const data = await res.json()
      setMessages([...newMessages, { role: 'assistant', content: data.message }])
      if (data.readyToConfirm) setStage('confirm')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    setStage('deploying')
    setSteps([
      { label: 'Генерую код', status: 'active' },
      { label: 'Пушу в GitHub', status: 'pending' },
      { label: 'Міграції БД', status: 'pending' },
      { label: 'Vercel build', status: 'pending' },
    ])
    setLoading(true)

    try {
      const res = await fetch('/api/admin/feature-agent/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStep('Генерую код', 'error', data.error)
        setStage('confirm')
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `❌ Помилка генерації: ${data.error}` },
        ])
        return
      }

      setStep('Генерую код', 'done', `${data.fileCount} файл(ів)`)
      setStep('Пушу в GitHub', 'done', data.branch)

      if (data.migrationsRun > 0) {
        setStep('Міграції БД', 'done', `${data.migrationsRun} запущено`)
      } else if (data.migrationErrors?.length > 0) {
        setStep('Міграції БД', 'error', data.migrationErrors[0])
      } else {
        setStep('Міграції БД', 'done', 'немає міграцій')
      }

      setStep('Vercel build', 'active', 'Очікуємо...')

      setBranch(data.branch)
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `🔀 Гілка \`${data.branch}\` створена (${data.fileCount} файл(ів)). Vercel будує preview...`,
        },
      ])
    } catch {
      setStep('Генерую код', 'error', 'Мережева помилка')
      setStage('confirm')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeployProd() {
    setLoading(true)
    try {
      await fetch('/api/admin/feature-agent/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch }),
      })
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '🚀 Влито в main → production деплой запущено!' },
      ])
    } finally {
      setStage('chat')
      setBranch('')
      setStagingUrl('')
      setSteps([])
      setLoading(false)
    }
  }

  async function handleRollback() {
    setLoading(true)
    try {
      await fetch('/api/admin/feature-agent/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch }),
      })
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '↩️ Гілку видалено. Продовжуй описувати що треба змінити.' },
      ])
    } finally {
      setStage('chat')
      setBranch('')
      setStagingUrl('')
      setSteps([])
      setLoading(false)
    }
  }

  const stepIcon = (s: Step['status']) => {
    if (s === 'done') return <span className="text-green-500">✓</span>
    if (s === 'error') return <span className="text-red-500">✗</span>
    if (s === 'active') return <span className="animate-spin inline-block">⟳</span>
    return <span className="text-gray-300">○</span>
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-3xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">Feature Agent</h1>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 whitespace-pre-wrap text-sm ${
                msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && stage !== 'deploying' && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2 text-sm text-gray-500">Думаю...</div>
          </div>
        )}

        {/* Deploy progress block */}
        {(stage === 'deploying' || (stage === 'deployed' && steps.length > 0)) && steps.length > 0 && (
          <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-gray-700">Прогрес деплою</span>
              {stage === 'deploying' && (
                <span className="text-xs text-gray-400">{buildElapsed}s</span>
              )}
            </div>
            {steps.map((step) => (
              <div key={step.label} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 w-4 shrink-0 text-center">{stepIcon(step.status)}</span>
                <div>
                  <span className={step.status === 'error' ? 'text-red-600' : step.status === 'done' ? 'text-gray-900' : 'text-gray-500'}>
                    {step.label}
                  </span>
                  {step.detail && (
                    <span className="ml-2 text-xs text-gray-400 break-all">{step.detail}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Action buttons after staging deploy */}
      {stage === 'deployed' && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {stagingUrl && (
            <a href={stagingUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">
              Перевірити на staging →
            </a>
          )}
          {githubUrl && !stagingUrl && (
            <a href={githubUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline">
              Переглянути на GitHub →
            </a>
          )}
          <div className="ml-auto flex gap-2">
            <button
              onClick={handleDeployProd}
              disabled={loading}
              className="bg-green-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            >
              🚀 Deploy to Prod
            </button>
            <button
              onClick={handleRollback}
              disabled={loading}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded text-sm disabled:opacity-50"
            >
              ↩️ Rollback
            </button>
          </div>
        </div>
      )}

      {/* Confirm button */}
      {stage === 'confirm' && (
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="mb-4 bg-blue-600 text-white px-6 py-2 rounded text-sm w-full disabled:opacity-50"
        >
          ✅ Підтверджую — Deploy to Staging
        </button>
      )}

      {/* Input — hidden during deploying */}
      {stage !== 'deploying' && (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder={stage === 'deployed' ? 'Доповни або опиши наступну зміну...' : 'Опиши що треба зробити...'}
            disabled={loading}
            className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            Надіслати
          </button>
        </div>
      )}
    </div>
  )
}
