import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60 // Vercel Pro required
import { createClient } from '@/lib/supabase/server'
import { ai, MODELS } from '@/lib/ai'
import { createBranch, upsertFile, deleteFile } from '@/lib/github'

const CODEGEN_SYSTEM = `
You are a code generation agent for a Next.js 15 App Router application.

Stack: Next.js 15, TypeScript strict, Supabase (auth + DB), Stripe, Tailwind CSS, OpenRouter AI.
Auth: Supabase — role is stored in user.user_metadata.role ('admin' | 'user').
Never import from @clerk/nextjs or any Clerk package — it is not installed.

App structure:
- app/                   Next.js App Router pages and API routes
- app/sign-in/           Auth pages (Supabase)
- app/sign-up/
- app/setup/             First-run admin setup
- app/dashboard/         Regular user dashboard
- app/admin/             Admin-only pages (check user.user_metadata.role === 'admin')
- app/admin/dashboard/   Metrics dashboard
- app/admin/features/    Feature Agent UI
- app/api/               API routes
- lib/supabase/server.ts createClient() — server-side Supabase client
- lib/supabase/client.ts createClient() — browser Supabase client
- lib/ai.ts              OpenRouter AI client
- lib/github.ts          GitHub API helpers
- config/app.ts          App config and roles
- middleware.ts           Auth guard (Supabase session)

Based on the conversation history, generate exact code changes.

Return ONLY valid JSON — no markdown fences, no explanation, just the JSON object:
{
  "branch": "feature/<slug>-<unix-timestamp>",
  "commitMessage": "feat: <short description>",
  "files": [
    {
      "path": "app/example/page.tsx",
      "content": "<full file content>",
      "action": "create"
    }
  ]
}

Rules:
- action: "create" for new files, "update" for existing, "delete" for removal
- branch: use actual unix timestamp (seconds) in the name
- Include complete file content with all imports
- Use "use client" only when needed (event handlers, useState, etc.)
- Use Tailwind for all styling
- Keep it minimal — only what was discussed
`

type FileChange = {
  path: string
  content: string
  action: 'create' | 'update' | 'delete'
}

type CodePlan = {
  branch: string
  commitMessage: string
  files: FileChange[]
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.user_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { messages } = await req.json()

  const response = await ai.chat.completions.create({
    model: MODELS.code,
    max_tokens: 8000,
    messages: [
      { role: 'system', content: CODEGEN_SYSTEM },
      ...messages,
      { role: 'user', content: 'Generate the code changes now. Return only the JSON object.' },
    ],
  })

  const raw = response.choices[0]?.message?.content || ''

  // Strip markdown code fences if Claude added them
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'Code generation failed — no JSON returned' }, { status: 500 })
  }

  let plan: CodePlan
  try {
    plan = JSON.parse(jsonMatch[0])
  } catch {
    return NextResponse.json({ error: 'Code generation failed — invalid JSON' }, { status: 500 })
  }

  // Create branch from main
  await createBranch(plan.branch)

  // Commit each file
  for (const file of plan.files) {
    if (file.action === 'delete') {
      await deleteFile(file.path, plan.branch, plan.commitMessage)
    } else {
      await upsertFile(file.path, file.content, plan.branch, plan.commitMessage)
    }
  }

  return NextResponse.json({
    branch: plan.branch,
    commitMessage: plan.commitMessage,
    fileCount: plan.files.length,
  })
}
