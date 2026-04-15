import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDeploymentByBranch } from '@/lib/vercel-deploy'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const branch = req.nextUrl.searchParams.get('branch')
  if (!branch) {
    return NextResponse.json({ error: 'Missing branch' }, { status: 400 })
  }

  if (!process.env.VERCEL_TOKEN || !process.env.VERCEL_PROJECT_ID) {
    return NextResponse.json({
      state: 'NO_VERCEL',
      url: null,
      githubUrl: `https://github.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/tree/${branch}`,
    })
  }

  const { state, url } = await getDeploymentByBranch(branch)

  return NextResponse.json({ state, url })
}
