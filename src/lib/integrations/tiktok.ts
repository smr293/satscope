import axios from 'axios'

const BASE_URL = 'https://graph.tiktok.com'

export async function getAccessToken(clientKey: string, clientSecret: string, code: string) {
  const response = await axios.post(`${BASE_URL}/oauth/token/`, {
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
  })

  return response.data.access_token
}

export async function tiktokUpload(
  videoPath: string,
  description: string,
  privacyLevel: string = 'PUBLIC_TO_EVERYONE'
) {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN
  
  if (!accessToken) {
    throw new Error('TikTok access token not configured')
  }

  // Step 1: Initialize upload
  const initResponse = await axios.post(
    `${BASE_URL}/post/publish/init/`,
    {
      post_info: {
        title: description,
        privacy_level: privacyLevel,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: 0, // Will be updated with actual file size
        chunk_size: 10485760, // 10MB chunks
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
    }
  )

  const { publish_id, upload_url } = initResponse.data

  // Step 2: Upload video (simplified - in production implement chunked upload)
  const fs = await import('fs')
  const videoData = fs.readFileSync(videoPath)

  await axios.put(upload_url, videoData, {
    headers: {
      'Content-Type': 'video/mp4',
    },
  })

  // Step 3: Finalize
  const finalizeResponse = await axios.post(
    `${BASE_URL}/post/publish/finalize/`,
    { publish_id },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
    }
  )

  return {
    success: true,
    publish_id,
    status: finalizeResponse.data.status,
  }
}

export async function scrapeTrends(query?: string) {
  // Use Playwright for scraping (official API doesn't provide trend data)
  const { chromium } = await import('playwright')
  
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  
  try {
    const searchUrl = query 
      ? `https://www.tiktok.com/tag/${encodeURIComponent(query)}`
      : 'https://www.tiktok.com/foryou'
    
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 })
    
    // Extract trending content
    const trends = await page.evaluate(() => {
      const videos = document.querySelectorAll('div[data-e2e="feedVideo"]')
      return Array.from(videos).slice(0, 10).map((video: any) => ({
        description: video.querySelector('h2')?.textContent || '',
        likes: video.querySelector('[aria-label*="likes"]')?.textContent || '',
        shares: video.querySelector('[aria-label*="shares"]')?.textContent || '',
      }))
    })
    
    return { success: true, trends }
  } catch (error) {
    return { success: false, error: error.message }
  } finally {
    await browser.close()
  }
}

export async function scrapeCreators(query?: string) {
  const { chromium } = await import('playwright')
  
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  
  try {
    const searchUrl = query
      ? `https://www.tiktok.com/search?q=${encodeURIComponent(query)}&type=user`
      : 'https://www.tiktok.com/creator-marketplace'
    
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 })
    
    const creators = await page.evaluate(() => {
      const profiles = document.querySelectorAll('div[data-e2e="user-profile-card"]')
      return Array.from(profiles).slice(0, 10).map((profile: any) => ({
        username: profile.querySelector('h3')?.textContent || '',
        followers: profile.querySelector('[aria-label*="followers"]')?.textContent || '',
        bio: profile.querySelector('p')?.textContent || '',
      }))
    })
    
    return { success: true, creators }
  } catch (error) {
    return { success: false, error: error.message }
  } finally {
    await browser.close()
  }
}
