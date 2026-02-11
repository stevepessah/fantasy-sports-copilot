import { NextRequest, NextResponse } from 'next/server'
import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

// Map season year to Yahoo game key for MLB
const seasonToGameKey: Record<number, string> = {
  2026: '469',
  2025: '458',
  2024: '431',
  2023: '422',
  2022: '414',
}

// Cache stat categories per game key to avoid repeated API calls
const statCategoriesCache: Record<string, { categories: Record<string, { name: string; displayName: string; positionType: string }>; timestamp: number }> = {}
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('yahoo_access_token')?.value
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    const playerKey = searchParams.get('playerKey')
    const leagueKey = searchParams.get('leagueKey')
    const seasonParam = searchParams.get('season')
    const season = seasonParam ? parseInt(seasonParam, 10) : undefined
    
    if (!playerKey) {
      return NextResponse.json(
        { error: 'playerKey parameter is required' },
        { status: 400 }
      )
    }
    
    const api = new YahooFantasyAPI()
    api.setAccessToken(accessToken)
    
    // Determine game key for stat categories
    let gameKey = playerKey.split('.')[0] // Extract from player key
    if (season && seasonToGameKey[season]) {
      gameKey = seasonToGameKey[season]
    }
    
    // Fetch player stats and stat categories in parallel
    const [statsResponse, categoriesData] = await Promise.all([
      api.getPlayerStats(playerKey, leagueKey || undefined, season),
      getStatCategories(api, gameKey)
    ])
    
    // Remap stats from numeric IDs to proper display names
    const remappedStats = remapStats(statsResponse.stats, categoriesData)
    
    return NextResponse.json({ 
      stats: remappedStats,
      playerKey,
      leagueKey: leagueKey || null,
      season: season || null,
      hasStats: !!(remappedStats?.season_stats && Object.keys(remappedStats.season_stats).length > 0)
    })
  } catch (error) {
    console.error('Error fetching Yahoo player stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch player stats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function getStatCategories(
  api: YahooFantasyAPI,
  gameKey: string
): Promise<Record<string, { name: string; displayName: string; positionType: string }>> {
  // Check cache first
  const cached = statCategoriesCache[gameKey]
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.categories
  }
  
  try {
    const result = await api.getStatCategories(gameKey)
    statCategoriesCache[gameKey] = {
      categories: result.categories,
      timestamp: Date.now()
    }
    console.log(`Fetched stat categories for game ${gameKey}:`, 
      Object.entries(result.categories).map(([id, cat]) => `${id}=${cat.displayName}(${cat.positionType})`).join(', ')
    )
    return result.categories
  } catch (error) {
    console.error(`Failed to fetch stat categories for game ${gameKey}:`, error)
    return {}
  }
}

function remapStats(
  rawStats: any,
  categories: Record<string, { name: string; displayName: string; positionType: string }>
) {
  if (!rawStats) return null
  
  const result: any = {
    player_key: rawStats.player_key,
    player_id: rawStats.player_id,
    name: rawStats.name,
    position_type: rawStats.position_type,
    season_stats: {},
    week_stats: {},
    ytd_stats: {},
    // Include the stat categories mapping for the frontend
    stat_categories: categories
  }
  
  // Remap each stats section
  const sections = ['season_stats', 'week_stats', 'ytd_stats'] as const
  
  for (const section of sections) {
    const sectionData = rawStats[section]
    if (!sectionData) continue
    
    const remapped: Record<string, { value: number | string; displayName: string; positionType: string; statId: string }> = {}
    
    for (const [key, value] of Object.entries(sectionData)) {
      // Only process numeric keys (stat IDs) - skip name-based keys that the parser also adds
      if (!/^\d+$/.test(key)) continue
      
      const category = categories[key]
      if (category) {
        remapped[category.displayName] = {
          value: value as number | string,
          displayName: category.displayName,
          positionType: category.positionType,
          statId: key
        }
      } else {
        // Unknown stat ID - include it anyway
        remapped[`stat_${key}`] = {
          value: value as number | string,
          displayName: `Stat ${key}`,
          positionType: 'unknown',
          statId: key
        }
      }
    }
    
    result[section] = remapped
  }
  
  return result
}
