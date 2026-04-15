// app/api/admin/feature-agent/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ai, MODELS } from '@/lib/ai'
import { withRateLimit } from '@/lib/rate-limit'
import { APP_CONFIG } from '@/config/app'

const SYSTEM_PROMPT = `
Ти — Feature Agent для продукту "${APP_CONFIG.name}".

Стек: Next.js 15, Supabase (auth + DB), Stripe, OpenRouter AI, Tailwind CSS, TypeScript strict.
Auth: Supabase — роль зберігається в user.user_metadata.role ('admin' | 'user').

Правила:
1. Завжди уточнюй деталі через питання — не більше 3 питань за раз
2. Після отримання деталей — покажи чіткий план змін (файли, ендпоінти, тести)
3. Закінчуй план словом "Підтверджуєш?"
4. Ніколи не починай генерацію коду без явного підтвердження
5. Будь конкретним — назви файлів, назви функцій, назви таблиць БД

Якщо юзер написав "Підтверджую", "Так", "Go", "Давай" — відповідай тільки:
READY_TO_DEPLOY
`

export const POST = withRateLimit(async (req: NextRequest) => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { messages } = await req.json()

  const response = await ai.chat.completions.create({
    model: MODELS.smart,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ],
  })

  const message = response.choices[0]?.message?.content || ''
  const readyToConfirm = message.trim() === 'READY_TO_DEPLOY'

  return NextResponse.json({
    message: readyToConfirm
      ? 'Зрозумів. Все готово до запуску. Натисни "Підтверджую" щоб задеплоїти на staging.'
      : message,
    readyToConfirm,
  })
}, { limit: 30, windowMs: 60_000 })
