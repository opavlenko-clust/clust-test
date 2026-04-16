// lib/ai.ts — OpenRouter via native fetch (no openai package needed)

export const MODELS = {
  fast: 'anthropic/claude-3.5-haiku',
  smart: 'anthropic/claude-sonnet-4-5',
  vision: 'anthropic/claude-sonnet-4-5',
  code: 'anthropic/claude-sonnet-4-5',
}

type Message = { role: 'system' | 'user' | 'assistant'; content: string }

type ChatCompletionOptions = {
  model: string
  max_tokens?: number
  messages: Message[]
}

async function chatCompletionsCreate(opts: ChatCompletionOptions) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY ?? ''}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': `https://${process.env.NEXT_PUBLIC_APP_DOMAIN ?? ''}`,
      'X-Title': process.env.NEXT_PUBLIC_APP_NAME ?? '',
    },
    body: JSON.stringify(opts),
  })
  if (!res.ok) {
    throw new Error(`OpenRouter error: ${res.status} ${await res.text()}`)
  }
  return res.json() as Promise<{
    choices: { message: { content: string } }[]
  }>
}

// Keep the same `ai.chat.completions.create(...)` call signature
export const ai = {
  chat: {
    completions: {
      create: chatCompletionsCreate,
    },
  },
}

export async function generateText({
  prompt,
  system,
  model = MODELS.smart,
  maxTokens = 1000,
}: {
  prompt: string
  system?: string
  model?: string
  maxTokens?: number
}) {
  try {
    const response = await chatCompletionsCreate({
      model,
      max_tokens: maxTokens,
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        { role: 'user' as const, content: prompt },
      ],
    })
    return response.choices[0]?.message?.content ?? ''
  } catch (error) {
    if (model === MODELS.smart) {
      return generateText({ prompt, system, model: MODELS.fast, maxTokens })
    }
    throw error
  }
}
