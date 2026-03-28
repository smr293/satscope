import { NextRequest, NextResponse } from 'next/server'
import { buildAgentFromPrompt, saveAgent } from '@/lib/ai/builder'

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Build agent configuration using Codex
    const config = await buildAgentFromPrompt(prompt)

    // Save to database
    const id = await saveAgent(config)

    return NextResponse.json({
      success: true,
      agent: {
        id,
        ...config,
      },
    })
  } catch (error: any) {
    console.error('Failed to build agent:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to build agent' },
      { status: 500 }
    )
  }
}
