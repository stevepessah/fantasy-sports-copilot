import { NextRequest, NextResponse } from 'next/server'
import { hasOpenAIConfig } from '@/lib/env'

export const dynamic = 'force-dynamic'

export interface MatchupRecapCategoryRow {
  stat: string
  userVal: number | string | null
  oppVal: number | string | null
  winner: 'user' | 'opp' | 'tie'
}

export interface MatchupRecapRequest {
  userTeamName: string
  opponentName: string
  week: number
  status: string
  categoryResults?: {
    userWins: number
    oppWins: number
    ties: number
    rows: MatchupRecapCategoryRow[]
  }
  userPoints?: number
  opponentPoints?: number
  userWinProbability?: number
  opponentWinProbability?: number
}

const recapCache: Record<string, { summary: string; ts: number }> = {}
const CACHE_TTL = 5 * 60 * 1000

export function buildMatchupPrompt(req: MatchupRecapRequest): string {
  let ctx = `Week ${req.week} matchup: ${req.userTeamName} vs ${req.opponentName}\n`
  ctx += `Status: ${req.status === 'midevent' ? 'In progress' : req.status === 'postevent' ? 'Final' : 'Upcoming'}\n\n`

  if (req.categoryResults) {
    const { userWins, oppWins, ties, rows } = req.categoryResults
    ctx += `Category tally: ${req.userTeamName} ${userWins}, ${req.opponentName} ${oppWins}`
    if (ties > 0) ctx += `, Tied ${ties}`
    ctx += '\n\n'

    ctx += 'CATEGORY BREAKDOWN:\n'
    for (const row of rows) {
      const userStr = row.userVal != null ? String(row.userVal) : '-'
      const oppStr = row.oppVal != null ? String(row.oppVal) : '-'
      const marker = row.winner === 'user' ? ' ← winning' : row.winner === 'opp' ? ' ← losing' : ' (tied)'
      ctx += `- ${row.stat}: ${req.userTeamName} ${userStr} vs ${req.opponentName} ${oppStr}${marker}\n`
    }
  } else if (req.userPoints != null && req.opponentPoints != null) {
    ctx += `Points: ${req.userTeamName} ${req.userPoints.toFixed(1)} vs ${req.opponentName} ${req.opponentPoints.toFixed(1)}\n`
  }

  if (req.userWinProbability != null) {
    ctx += `\nWin probability: ${req.userTeamName} ${req.userWinProbability}%`
    if (req.opponentWinProbability != null) ctx += `, ${req.opponentName} ${req.opponentWinProbability}%`
    ctx += '\n'
  }

  return ctx
}

function hasMatchupData(req: MatchupRecapRequest): boolean {
  if (req.categoryResults && req.categoryResults.rows.length > 0) return true
  if (req.userPoints != null && req.opponentPoints != null) return true
  return false
}

export async function POST(request: NextRequest) {
  try {
    if (!hasOpenAIConfig()) {
      return NextResponse.json({ summary: null })
    }

    const body: MatchupRecapRequest = await request.json()
    const { userTeamName, opponentName, week, status } = body

    if (!userTeamName || !opponentName) {
      return NextResponse.json({ summary: null })
    }

    if (!hasMatchupData(body)) {
      return NextResponse.json({
        summary: `No stats recorded yet for the Week ${week} matchup between ${userTeamName} and ${opponentName}. Games may not have started yet.`,
      })
    }

    const cacheKey = `${userTeamName}::${opponentName}::${week}::${status}`
    const cached = recapCache[cacheKey]
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({ summary: cached.summary })
    }

    const matchupPrompt = buildMatchupPrompt(body)

    const { OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a concise fantasy baseball analyst. Given a head-to-head matchup between two teams with their stat category comparisons, write exactly 3-4 sentences analyzing the matchup. Mention which categories each team is winning, highlight the closest battles, and give one brief strategic suggestion. Reference actual stat values. Write in a confident, conversational tone as if briefing the team manager. Do NOT use bullet points or headers — write flowing prose.`,
        },
        {
          role: 'user',
          content: matchupPrompt,
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
    console.error('Error generating matchup recap:', error)
    return NextResponse.json(
      { summary: null, error: error.message || 'Failed to generate matchup recap' },
      { status: 200 },
    )
  }
}
