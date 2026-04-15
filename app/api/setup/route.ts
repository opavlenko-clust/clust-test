import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function adminExists(): Promise<boolean> {
  const admin = getAdminClient()
  const { data } = await admin.auth.admin.listUsers()
  return (data?.users ?? []).some(u => u.user_metadata?.role === 'admin')
}

export async function GET() {
  const exists = await adminExists()
  return NextResponse.json({ configured: exists })
}

export async function POST(req: NextRequest) {
  const exists = await adminExists()
  if (exists) {
    return NextResponse.json({ error: 'Already configured' }, { status: 403 })
  }

  const { email, password } = await req.json()
  if (!email || !password || password.length < 8) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const admin = getAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'admin' },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, userId: data.user.id })
}
