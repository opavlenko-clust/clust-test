'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Gender = 'male' | 'female' | 'other'

const options: { value: Gender; label: string; emoji: string }[] = [
  { value: 'male', label: 'Чоловік', emoji: '👨' },
  { value: 'female', label: 'Жінка', emoji: '👩' },
  { value: 'other', label: 'Інше', emoji: '🧑' },
]

export default function QuizForm() {
  const router = useRouter()
  const [selected, setSelected] = useState<Gender | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!selected) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/quiz/gender', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gender: selected }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Щось пішло не так')
        return
      }

      router.push('/dashboard')
    } catch {
      setError('Помилка мережі. Спробуйте ще раз.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => setSelected(option.value)}
          className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
            selected === option.value
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
              : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50 text-gray-700'
          }`}
        >
          <span className="text-2xl">{option.emoji}</span>
          <span className="text-lg font-medium">{option.label}</span>
        </button>
      ))}

      {error && (
        <p className="text-red-500 text-sm text-center">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!selected || loading}
        className="mt-4 w-full py-3 px-6 rounded-xl bg-indigo-600 text-white font-semibold text-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Збереження...' : 'Продовжити'}
      </button>
    </div>
  )
}
