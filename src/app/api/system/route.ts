import { NextRequest, NextResponse } from 'next/server'
import { executePowerShell, getSystemInfo, getDiskUsage, getRunningProcesses } from '@/lib/system/powershell'

export async function POST(request: NextRequest) {
  try {
    const { command } = await request.json()

    if (!command || typeof command !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Command is required' },
        { status: 400 }
      )
    }

    const result = await executePowerShell(command)

    return NextResponse.json({
      success: true,
      output: result.output,
      error: result.error,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    let result

    switch (type) {
      case 'system':
        result = await getSystemInfo()
        break
      case 'disk':
        result = await getDiskUsage()
        break
      case 'processes':
        result = await getRunningProcesses()
        break
      default:
        result = await getSystemInfo()
    }

    return NextResponse.json({
      success: true,
      data: result.output,
      error: result.error,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
