import { NextRequest, NextResponse } from 'next/server'
import { hasOpenAIConfig } from '@/lib/env'

export const dynamic = 'force-dynamic'

interface RecapPlayer {
  name: string
  positionType: string
  selectedPosition: string
  stats: Record<string, number | string>
  injuryStatus?: string
}

interface RecapRequest {
  players: RecapPlayer[]
  teamName: string
  dateRangeLabel: string
}

const recapCache: Record<string, { summary: string; ts: number }> = {}
const CACHE_TTL = 5 * 60 * 1000

function buildStatsPrompt(players: RecapPlayer[], teamName: string, dateRangeLabel: string): string {
  const batters = players.filter((p) => p.positionType === 'B')
  const pitchers = players.filter((p) => p.positionType === 'P')

  let ctx = `Team: ${teamName}\nTime period: ${dateRangeLabel}\n\n`

  if (batters.length > 0) {
    ctx += 'BATTERS:\n'
    for (const b of batters) {
      const statLine = Object.entries(b.stats)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
      const injury = b.injuryStatus ? ` [${b.injuryStatus}]` : ''
      ctx += `- ${b.name} (${b.selectedPosition})${injury}: ${statLine || 'no stats'}\n`
    }
    ctx += '\n'
  }

  if (pitchers.length > 0) {
    ctx += 'PITCHERS:\n'
    for (const p of pitchers) {
      const statLine = Object.entries(p.stats)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
      const injury = p.injuryStatus ? ` [${p.injuryStatus}]` : ''
      ctx += `- ${p.name} (${p.selectedPosition})${injury}: ${statLine || 'no stats'}\n`
    }
  }

  return ctx
}

function hasAnyStats(players: RecapPlayer[]): boolean {
  return players.some((p) => Object.keys(p.stats).length > 0)
}

export async function POST(request: NextRequest) {
  try {
    if (!hasOpenAIConfig()) {
      return NextResponse.json({ summary: null })
    }

    const body: RecapRequest = await request.json()
    const { players, teamName, dateRangeLabel } = body

    if (!players || players.length === 0) {
      return NextResponse.json({ summary: null })
    }

    if (!hasAnyStats(players)) {
      return NextResponse.json({
        summary: `No stats recorded for ${teamName} during ${dateRangeLabel}. Games may not have started yet, or no players were active during this period.`,
      })
    }

    // Check cache
    const cacheKey = `${teamName}::${dateRangeLabel}::${players.length}`
    const cached = recapCache[cacheKey]
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({ summary: cached.summary })
    }

    const statsPrompt = buildStatsPrompt(players, teamName, dateRangeLabel)

    const { OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a concise fantasy baseball analyst. Given a team's roster stats for a specific time period, write exactly 3-4 sentences summarizing how the team performed. Highlight standout performers by name, mention anyone struggling, and note any injury concerns. Be specific with stats — reference actual numbers. Write in a confident, conversational tone as if briefing the team manager. Do NOT use bullet points or headers — write flowing prose.`,
        },
        {
          role: 'user',
          content: statsPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    })

    const summary = completion.choices[0]?.message?.content?.trim() || null

    if (summary) {
      recapCache[cacheKey] = { summary, ts: Date.now() }
    }

    return NextResponse.json({ summary })
  } catch (error: any) {
    console.error('Error generating roster recap:', error)
    return NextResponse.json(
      { summary: null, error: error.message || 'Failed to generate recap' },
      { status: 200 },
    )
  }
}
