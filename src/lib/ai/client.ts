import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function chatWithModel({
  model = 'gpt-4o',
  messages,
  tools,
}: {
  model: string
  messages: any[]
  tools?: any[]
}) {
  const response = await openai.chat.completions.create({
    model,
    messages,
    tools,
    tool_choice: tools ? 'auto' : undefined,
  })

  return response.choices[0].message
}

export async function generateWithCodex(prompt: string) {
  const response = await openai.chat.completions.create({
    model: 'codex-mini-latest',
    messages: [
      {
        role: 'system',
        content: 'You are an expert AI agent builder. Generate complete agent configurations from natural language prompts.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    response_format: { type: 'json_object' },
  })

  return JSON.parse(response.choices[0].message.content || '{}')
}

export function countTokens(text: string): number {
  // Simple estimation - in production use tiktoken
  return Math.ceil(text.length / 4)
}

export function calculateCost(tokens: number, model: string): number {
  const prices: Record<string, number> = {
    'gpt-4o': 0.000005,
    'gpt-4o-mini': 0.00000015,
    'codex-mini-latest': 0.000002,
    'claude-sonnet-4-20250514': 0.000003,
    'claude-opus-4-5': 0.000015,
  }
  
  const pricePerToken = prices[model] || 0.000002
  return tokens * pricePerToken
}
