import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_GENDERS = ['male', 'female', 'other'] as const
type Gender = typeof VALID_GENDERS[number]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { gender } = body as { gender: Gender }

    if (!gender || !VALID_GENDERS.includes(gender)) {
      return NextResponse.json(
        { error: 'Невалідне значення статі' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Не авторизований' },
        { status: 401 }
      )
    }

    const { error: updateError } = await supabase.auth.updateUser({
      data: { gender },
    })

    if (updateError) {
      return NextResponse.json(
        { error: 'Не вдалося зберегти дані' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Внутрішня помилка сервера' },
      { status: 500 }
    )
  }
}
