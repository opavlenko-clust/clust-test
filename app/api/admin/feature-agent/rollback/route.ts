import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteBranch } from '@/lib/github'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { branch } = await req.json()
  if (!branch) {
    return NextResponse.json({ error: 'Missing branch' }, { status: 400 })
  }

  await deleteBranch(branch)

  return NextResponse.json({ success: true })
}
