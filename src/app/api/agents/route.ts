import { NextRequest, NextResponse } from 'next/server'
import { getAgents, getAgent, deleteAgent, toggleAgent } from '@/lib/ai/builder'

export async function GET() {
  try {
    const agents = await getAgents()
    return NextResponse.json({ success: true, agents })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { id, isActive } = await request.json()

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    await toggleAgent(id, isActive !== false)

    const agent = await getAgent(id)
    return NextResponse.json({ success: true, agent })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Agent ID is required' },
        { status: 400 }
      )
    }

    await deleteAgent(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
