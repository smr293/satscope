import { NextRequest, NextResponse } from 'next/server'
import { tiktokUpload, scrapeTrends, scrapeCreators } from '@/lib/integrations/tiktok'

export async function POST(request: NextRequest) {
  try {
    const { action, ...params } = await request.json()

    let result

    switch (action) {
      case 'upload':
        result = await tiktokUpload(
          params.videoPath,
          params.description,
          params.privacyLevel
        )
        break
      case 'scrape_trends':
        result = await scrapeTrends(params.query)
        break
      case 'scrape_creators':
        result = await scrapeCreators(params.query)
        break
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
