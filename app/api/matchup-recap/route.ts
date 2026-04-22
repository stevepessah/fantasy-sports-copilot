import { NextRequest, NextResponse } from 'next/server'
import { hasOpenAIConfig } from '@/lib/env'
import { buildMatchupPrompt, hasMatchupData } from '@/lib/matchupRecap'
import type { MatchupRecapRequest } from '@/lib/matchupRecap'

export const dynamic = 'force-dynamic'

const recapCache: Record<string, { summary: string; ts: number }> = {}
const CACHE_TTL = 5 * 60 * 1000

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
