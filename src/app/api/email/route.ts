import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, verifyConnection } from '@/lib/integrations/email'

export async function POST(request: NextRequest) {
  try {
    const { to, subject, body, html } = await request.json()

    if (!to || !subject || !body) {
      return NextResponse.json(
        { success: false, error: 'To, subject, and body are required' },
        { status: 400 }
      )
    }

    const result = await sendEmail(to, subject, body, html)

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const result = await verifyConnection()
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
