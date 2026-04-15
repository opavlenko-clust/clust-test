export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Dashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  const isAdmin = user.user_metadata?.role === 'admin'
  if (isAdmin) redirect('/admin/dashboard')

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-500">Welcome, {user.email}</p>
    </div>
  )
}
