import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { YahooFantasyAPI } from '@/lib/yahoo/api'
import { withYahooAuth } from '@/lib/yahoo/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await withYahooAuth()
  if (!auth) {
    return NextResponse.json({ error: 'Not authenticated with Yahoo' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const leagueKey = searchParams.get('leagueKey')

  if (!leagueKey) {
    return NextResponse.json({ error: 'leagueKey query param is required' }, { status: 400 })
  }

  const api = new YahooFantasyAPI()
  api.setAccessToken(auth.accessToken)

  const { raw } = await api.getPlayers(leagueKey, {
    start: 0,
    count: 3,
    sort: 'AR',
    out: 'stats,ownership,percent_owned,draft_analysis',
  })

  if (raw) {
    const outPath = join(process.cwd(), 'debug-players-raw.xml')
    writeFileSync(outPath, raw, 'utf-8')
    return auth.json({ ok: true, wrote: outPath, bytes: raw.length })
  }

  return auth.json({ ok: false, error: 'No XML returned' })
}
