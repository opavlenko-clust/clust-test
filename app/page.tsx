import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

async function isConfigured(): Promise<boolean> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
  const { data } = await admin.auth.admin.listUsers()
  return (data?.users ?? []).some(u => u.user_metadata?.role === 'admin')
}

export default async function Home() {
  const configured = await isConfigured()
  redirect(configured ? '/sign-in' : '/setup')
}
