import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300 // Vercel Pro: up to 300s
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
- TypeScript strict: always use explicit types, NEVER leave implicit "any" (no untyped function params)
- Never modify infrastructure files unless explicitly asked: middleware.ts, lib/supabase/server.ts, lib/supabase/client.ts, lib/ai.ts, lib/github.ts, next.config.js
- Every new page/route that calls Supabase or does redirects must export: export const dynamic = 'force-dynamic'
- When a feature needs a new DB table or column, include a migration file: supabase/migrations/<timestamp>_<name>.sql (timestamp = unix seconds). The migration will be auto-run against Supabase. Always add IF NOT EXISTS to CREATE TABLE.
- When writing setAll cookie handlers, always type the param: (cookiesToSet: { name: string; value: string; options: CookieOptions }[])

UI Style (minimalist — Tailwind only, no component libraries):
- White background, generous whitespace
- text-gray-900 headings, text-gray-500 secondary, blue-600 accent
- Borders: border border-gray-200 — subtle, never decorative
- rounded-lg for cards/inputs, rounded for buttons
- No shadows except shadow-sm on cards
- Button primary: bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50
- Button secondary: bg-gray-100 text-gray-800 px-4 py-2 rounded text-sm hover:bg-gray-200
- Input: border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
- Card: border border-gray-200 rounded-lg p-6 bg-white
- Page layout: max-w-3xl mx-auto p-8
- Typography: text-xl font-bold (page title), text-base font-semibold (section), text-sm (body), text-sm text-gray-500 (muted)
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

  // Auto-run Supabase migrations if any SQL files were generated
  const migrations = plan.files.filter(
    f => f.path.startsWith('supabase/migrations/') && f.path.endsWith('.sql') && f.action !== 'delete'
  )

  let migrationsRun = 0
  const migrationErrors: string[] = []

  if (migrations.length > 0) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
    const managementToken = process.env.SUPABASE_MANAGEMENT_TOKEN

    if (projectRef && managementToken) {
      for (const migration of migrations) {
        const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${managementToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: migration.content }),
        })
        if (res.ok) {
          migrationsRun++
        } else {
          const err = await res.json().catch(() => ({ message: res.statusText })) as { message?: string }
          migrationErrors.push(`${migration.path}: ${err.message ?? res.statusText}`)
        }
      }
    }
  }

  return NextResponse.json({
    branch: plan.branch,
    commitMessage: plan.commitMessage,
    fileCount: plan.files.length,
    migrationsRun,
    migrationErrors,
  })
}
