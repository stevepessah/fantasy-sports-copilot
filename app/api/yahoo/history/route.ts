// Get historical league data (leagues + standings) for a past season
import { NextRequest, NextResponse } from 'next/server'
import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { MLB_SEASON_TO_GAME_KEY } from '@/lib/yahoo/config'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('yahoo_access_token')?.value

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated. Please connect your Yahoo account first.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const seasonParam = searchParams.get('season')
    const includeStandings = searchParams.get('standings') !== 'false' // default true

    const api = new YahooFantasyAPI()
    api.setAccessToken(accessToken)

    // If no season specified, return all seasons the user has leagues for
    if (!seasonParam) {
      const { leagues } = await api.getLeagues('all')

      // Group leagues by season
      const bySeasonMap = new Map<string, typeof leagues>()
      for (const league of leagues) {
        const season = league.season || 'unknown'
        if (!bySeasonMap.has(season)) bySeasonMap.set(season, [])
        bySeasonMap.get(season)!.push(league)
      }

      // Sort seasons descending
      const seasons = Array.from(bySeasonMap.entries())
        .map(([season, seasonLeagues]) => ({
          season,
          leagues: seasonLeagues,
        }))
        .sort((a, b) => parseInt(b.season) - parseInt(a.season))

      return NextResponse.json({ seasons }, {
        headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=600' },
      })
    }

    // Specific season requested
    const season = parseInt(seasonParam, 10)
    if (isNaN(season) || season < 2001 || season > 2030) {
      return NextResponse.json(
        { error: 'Invalid season. Must be a year between 2001 and 2030.' },
        { status: 400 }
      )
    }

    const gameKey = MLB_SEASON_TO_GAME_KEY[season]
    if (!gameKey) {
      return NextResponse.json(
        { error: `No game key mapped for season ${season}. Supported: ${Object.keys(MLB_SEASON_TO_GAME_KEY).join(', ')}` },
        { status: 400 }
      )
    }

    // Fetch leagues for that season
    const { leagues } = await api.getLeagues(gameKey)

    if (leagues.length === 0) {
      return NextResponse.json({
        season,
        gameKey,
        leagues: [],
        message: `No leagues found for the ${season} season.`,
      })
    }

    // Optionally fetch standings for each league
    const leaguesWithStandings = await Promise.all(
      leagues.map(async (league) => {
        if (!includeStandings) {
          return { ...league, standings: [] }
        }
        try {
          const { standings } = await api.getStandings(league.league_key)
          return { ...league, standings }
        } catch (err) {
          console.error(`Failed to fetch standings for ${league.league_key}:`, err)
          return { ...league, standings: [] }
        }
      })
    )

    return NextResponse.json({
      season,
      gameKey,
      leagues: leaguesWithStandings,
    }, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=3600' },
    })
  } catch (error) {
    console.error('Error fetching Yahoo history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch historical data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
